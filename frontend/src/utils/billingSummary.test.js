import { describe, expect, it } from 'vitest';
import { summarizeInvoices } from './billingSummary.js';

const REFERENCE_DATE = new Date('2026-08-04T00:00:00.000Z');

describe('summarizeInvoices', () => {
  it('sums outstanding balance and amount paid across invoices', () => {
    const totals = summarizeInvoices(
      [
        { total: 100, amountPaid: 100, status: 'paid', createdAt: '2026-08-01T00:00:00.000Z' },
        { total: 200, amountPaid: 50, status: 'partial', createdAt: '2026-08-01T00:00:00.000Z' },
        { total: 80, amountPaid: 0, status: 'unpaid', createdAt: '2026-08-01T00:00:00.000Z' },
      ],
      REFERENCE_DATE,
    );

    expect(totals.paid).toBe(150); // 100 + 50 + 0
    expect(totals.outstanding).toBe(230); // 0 + 150 + 80
  });

  it('counts an unpaid/partial balance as overdue once it is older than 30 days', () => {
    const totals = summarizeInvoices(
      [{ total: 100, amountPaid: 0, status: 'unpaid', createdAt: '2026-06-01T00:00:00.000Z' }],
      REFERENCE_DATE,
    );
    expect(totals.overdue).toBe(100);
  });

  it('does not count a recent unpaid balance as overdue', () => {
    const totals = summarizeInvoices(
      [{ total: 100, amountPaid: 0, status: 'unpaid', createdAt: '2026-08-01T00:00:00.000Z' }],
      REFERENCE_DATE,
    );
    expect(totals.overdue).toBe(0);
  });

  it('never counts a fully paid invoice as overdue, regardless of age', () => {
    const totals = summarizeInvoices(
      [{ total: 100, amountPaid: 100, status: 'paid', createdAt: '2026-01-01T00:00:00.000Z' }],
      REFERENCE_DATE,
    );
    expect(totals.overdue).toBe(0);
  });

  it('returns zero totals for an empty invoice list', () => {
    expect(summarizeInvoices([], REFERENCE_DATE)).toEqual({ outstanding: 0, paid: 0, overdue: 0 });
  });
});
