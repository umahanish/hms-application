import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import InvoiceList from './InvoiceList.jsx';

const INVOICES = [
  {
    id: 1,
    createdAt: '2026-08-01T10:00:00.000Z',
    department: 'OPD',
    total: 150,
    amountPaid: 150,
    status: 'paid',
  },
  {
    id: 2,
    createdAt: '2026-08-02T10:00:00.000Z',
    department: null,
    total: 200,
    amountPaid: 50,
    status: 'partial',
  },
];

describe('InvoiceList', () => {
  it('shows an empty message when there are no invoices', () => {
    render(<InvoiceList invoices={[]} />);
    expect(screen.getByText('No invoices yet.')).toBeInTheDocument();
  });

  it('renders each invoice with date, department, totals, and a status badge', () => {
    render(<InvoiceList invoices={INVOICES} />);

    expect(screen.getByText('INV-1')).toBeInTheDocument();
    expect(screen.getByText('2026-08-01')).toBeInTheDocument();
    expect(screen.getByText('OPD')).toBeInTheDocument();
    // $150.00 appears twice for invoice 1: it's both fully paid (Total) and (Paid).
    expect(screen.getAllByText('$150.00')).toHaveLength(2);
    // Scoped to the badge, since the table also has a "Paid" column header.
    expect(screen.getByText('Paid', { selector: '.status-badge' })).toBeInTheDocument();
    expect(screen.getByText('Partial', { selector: '.status-badge' })).toBeInTheDocument();
  });

  it('falls back to an em dash when department is not set', () => {
    render(<InvoiceList invoices={INVOICES} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls onSelectInvoice when an invoice link is clicked', async () => {
    const user = userEvent.setup();
    const onSelectInvoice = vi.fn();
    render(<InvoiceList invoices={INVOICES} onSelectInvoice={onSelectInvoice} />);

    await user.click(screen.getByRole('button', { name: 'INV-1' }));

    expect(onSelectInvoice).toHaveBeenCalledWith(INVOICES[0]);
  });

  it('renders invoice ids as plain text, not buttons, when onSelectInvoice is not provided', () => {
    render(<InvoiceList invoices={INVOICES} />);
    expect(screen.queryByRole('button', { name: 'INV-1' })).not.toBeInTheDocument();
    expect(screen.getByText('INV-1')).toBeInTheDocument();
  });
});
