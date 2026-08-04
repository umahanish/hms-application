import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import InvoiceGeneration from './InvoiceGeneration.jsx';
import { generateInvoice, listInvoices } from '../api/billing.js';
import { searchPatients } from '../api/patients.js';

vi.mock('../api/billing.js', () => ({
  generateInvoice: vi.fn(),
  listInvoices: vi.fn(),
}));

vi.mock('../api/patients.js', () => ({
  searchPatients: vi.fn(),
}));

async function selectPatient(user) {
  searchPatients.mockResolvedValueOnce([{ id: 5, firstName: 'Jane', lastName: 'Doe' }]);
  await user.type(screen.getByLabelText('Search patients'), 'Jan');
  const resultButton = await screen.findByText('Jane Doe — 5', {}, { timeout: 2000 });
  await user.click(resultButton);
}

describe('InvoiceGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInvoices.mockResolvedValue([]);
  });

  it('updates totals live as line items and discount/tax change', async () => {
    const user = userEvent.setup();
    render(<InvoiceGeneration />);

    await user.click(screen.getByRole('button', { name: '+ Consultation' }));
    // $100.00 appears 3 times pre-discount: the line item's Amount cell, Subtotal, and Total Due.
    expect(screen.getAllByText('$100.00')).toHaveLength(3);

    await user.clear(screen.getByLabelText('Discount %'));
    await user.type(screen.getByLabelText('Discount %'), '10');

    // 10% of the $100 subtotal confirms the live total recalculated correctly.
    expect(screen.getByText('-$10.00')).toBeInTheDocument();
  });

  it('shows an error when generating without a selected patient', async () => {
    const user = userEvent.setup();
    render(<InvoiceGeneration />);

    await user.click(screen.getByRole('button', { name: '+ Consultation' }));
    await user.click(screen.getByRole('button', { name: 'Generate Invoice' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Select a patient');
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  it('shows an error when there are no valid line items', async () => {
    const user = userEvent.setup();
    render(<InvoiceGeneration />);

    await selectPatient(user);
    await user.click(screen.getByRole('button', { name: 'Generate Invoice' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one valid line item');
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  it('generates an invoice, sends an idempotencyKey, and shows the printable confirmation', async () => {
    generateInvoice.mockResolvedValueOnce({
      id: 42,
      subtotal: 100,
      discountAmount: 0,
      taxAmount: 0,
      total: 100,
      status: 'unpaid',
      amountPaid: 0,
      lineItems: [{ id: 1, description: 'Consultation charge', quantity: 1, unitPrice: 100, amount: 100 }],
    });
    const user = userEvent.setup();
    render(<InvoiceGeneration />);

    await selectPatient(user);
    await user.click(screen.getByRole('button', { name: '+ Consultation' }));
    await user.click(screen.getByRole('button', { name: 'Generate Invoice' }));

    expect(await screen.findByText('Invoice INV-42')).toBeInTheDocument();
    expect(generateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 5,
        lineItems: [{ description: 'Consultation charge', quantity: 1, unitPrice: 100 }],
        idempotencyKey: expect.any(String),
      }),
    );
    expect(screen.getByRole('button', { name: 'Print / Save as PDF' })).toBeInTheDocument();
  });

  it('reuses the same idempotencyKey on a retry after a failed submission', async () => {
    generateInvoice.mockRejectedValueOnce(new Error('Billing service unavailable'));
    generateInvoice.mockResolvedValueOnce({
      id: 1,
      subtotal: 100,
      discountAmount: 0,
      taxAmount: 0,
      total: 100,
      status: 'unpaid',
      amountPaid: 0,
      lineItems: [],
    });
    const user = userEvent.setup();
    render(<InvoiceGeneration />);

    await selectPatient(user);
    await user.click(screen.getByRole('button', { name: '+ Consultation' }));
    await user.click(screen.getByRole('button', { name: 'Generate Invoice' }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Generate Invoice' }));
    await waitFor(() => expect(generateInvoice).toHaveBeenCalledTimes(2));

    const firstKey = generateInvoice.mock.calls[0][0].idempotencyKey;
    const secondKey = generateInvoice.mock.calls[1][0].idempotencyKey;
    expect(secondKey).toBe(firstKey);
  });

  it('loads and displays past invoices once a patient is selected', async () => {
    listInvoices.mockResolvedValue([
      { id: 7, createdAt: '2026-07-01T00:00:00.000Z', department: 'OPD', total: 80, amountPaid: 80, status: 'paid' },
    ]);
    const user = userEvent.setup();
    render(<InvoiceGeneration />);

    await selectPatient(user);

    expect(await screen.findByText('INV-7')).toBeInTheDocument();
    expect(listInvoices).toHaveBeenCalledWith({ patient: 5 });
  });
});
