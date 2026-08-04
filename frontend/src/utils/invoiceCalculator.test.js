import { describe, expect, it } from 'vitest';
import { calculateInvoiceTotals } from './invoiceCalculator.js';

describe('calculateInvoiceTotals', () => {
  it('computes subtotal and total with no discount or tax', () => {
    const totals = calculateInvoiceTotals([
      { quantity: 2, unitPrice: 50 },
      { quantity: 1, unitPrice: 25 },
    ]);
    expect(totals).toEqual({ subtotal: 125, discountAmount: 0, taxAmount: 0, total: 125 });
  });

  it('applies tax to the post-discount amount', () => {
    const totals = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], {
      discountPercent: 10,
      taxPercent: 10,
    });
    expect(totals).toEqual({ subtotal: 100, discountAmount: 10, taxAmount: 9, total: 99 });
  });

  it('coerces string quantity/unitPrice values, tolerating in-progress form input', () => {
    const totals = calculateInvoiceTotals([{ quantity: '2', unitPrice: '10' }]);
    expect(totals.subtotal).toBe(20);
  });

  it('treats blank/invalid numeric fields as zero rather than NaN', () => {
    const totals = calculateInvoiceTotals([{ quantity: '', unitPrice: 'abc' }]);
    expect(totals).toEqual({ subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 });
  });

  it('returns zero totals for an empty line item list', () => {
    expect(calculateInvoiceTotals([])).toEqual({ subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 });
  });
});
