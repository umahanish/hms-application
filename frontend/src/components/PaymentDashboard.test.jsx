import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PaymentDashboard from './PaymentDashboard.jsx';
import { listInvoices, listPayments, recordPayment } from '../api/billing.js';

vi.mock('../api/billing.js', () => ({
  listInvoices: vi.fn(),
  listPayments: vi.fn(),
  recordPayment: vi.fn(),
}));

const INVOICE = {
  id: 10,
  createdAt: '2026-08-01T00:00:00.000Z',
  department: 'OPD',
  total: 200,
  amountPaid: 50,
  status: 'partial',
};

describe('PaymentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInvoices.mockResolvedValue([INVOICE]);
    listPayments.mockResolvedValue([]);
  });

  it('loads invoices and shows outstanding/paid totals', async () => {
    render(<PaymentDashboard />);

    expect(await screen.findByText('INV-10')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument(); // outstanding: 200 - 50, unique on the page
    // $50.00 appears twice: the dashboard's Paid total and the invoice row's own Paid column.
    expect(screen.getAllByText('$50.00')).toHaveLength(2);
  });

  it('refetches with the selected status when the status filter changes', async () => {
    const user = userEvent.setup();
    render(<PaymentDashboard />);
    await screen.findByText('INV-10');

    await user.selectOptions(screen.getByLabelText('Status'), 'paid');

    await waitFor(() => expect(listInvoices).toHaveBeenLastCalledWith({ status: 'paid', dateFrom: '', dateTo: '', department: '' }));
  });

  it('shows a graceful error state when loading invoices fails', async () => {
    listInvoices.mockReset();
    listInvoices.mockRejectedValueOnce(new Error('Billing service unavailable'));
    render(<PaymentDashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Billing service unavailable');
  });

  it('opens an invoice detail view with its payment history', async () => {
    listPayments.mockResolvedValueOnce([{ id: 1, amount: 50, method: 'card', status: 'succeeded' }]);
    const user = userEvent.setup();
    render(<PaymentDashboard />);

    await user.click(await screen.findByRole('button', { name: 'INV-10' }));

    expect(await screen.findByText('Invoice INV-10')).toBeInTheDocument();
    expect(screen.getByText('$50.00 via card — succeeded')).toBeInTheDocument();
    expect(listPayments).toHaveBeenCalledWith(10);
  });

  it('records a payment, updates the invoice detail, and refreshes the list', async () => {
    recordPayment.mockResolvedValueOnce({
      payment: { id: 2, amount: 150, method: 'cash', status: 'succeeded' },
      invoice: { ...INVOICE, amountPaid: 200, status: 'paid' },
    });
    const user = userEvent.setup();
    render(<PaymentDashboard />);

    await user.click(await screen.findByRole('button', { name: 'INV-10' }));
    await screen.findByText('Invoice INV-10');

    await user.type(screen.getByLabelText('Amount'), '150');
    await user.selectOptions(screen.getByLabelText('Method'), 'cash');
    await user.click(screen.getByRole('button', { name: 'Record Payment' }));

    expect(recordPayment).toHaveBeenCalledWith({ invoiceId: 10, amount: 150, method: 'cash' });
    expect(await screen.findByText('$150.00 via cash — succeeded')).toBeInTheDocument();
    expect(screen.getByText('Paid so far: $200.00')).toBeInTheDocument();
    await waitFor(() => expect(listInvoices).toHaveBeenCalledTimes(2));
  });

  it('rejects recording a payment of zero or less without calling the API', async () => {
    const user = userEvent.setup();
    render(<PaymentDashboard />);

    await user.click(await screen.findByRole('button', { name: 'INV-10' }));
    await screen.findByText('Invoice INV-10');
    await user.click(screen.getByRole('button', { name: 'Record Payment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('greater than zero');
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it('returns to the list view from the detail view', async () => {
    const user = userEvent.setup();
    render(<PaymentDashboard />);

    await user.click(await screen.findByRole('button', { name: 'INV-10' }));
    await screen.findByText('Invoice INV-10');
    await user.click(screen.getByRole('button', { name: '← Back to list' }));

    expect(screen.queryByText('Invoice INV-10')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'INV-10' })).toBeInTheDocument();
  });
});
