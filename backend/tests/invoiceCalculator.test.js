import { describe, expect, it } from 'vitest';
import { calculateInvoiceTotals } from '../src/services/invoiceCalculator.js';

describe('calculateInvoiceTotals', () => {
  it('computes subtotal and total with no discount or tax', () => {
    const totals = calculateInvoiceTotals([
      { quantity: 2, unitPrice: 50 },
      { quantity: 1, unitPrice: 25 },
    ]);
    expect(totals).toEqual({ subtotal: 125, discountAmount: 0, taxAmount: 0, total: 125 });
  });

  it('applies a percentage discount to the subtotal', () => {
    const totals = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], { discountPercent: 10 });
    expect(totals).toEqual({ subtotal: 100, discountAmount: 10, taxAmount: 0, total: 90 });
  });

  it('applies tax to the post-discount amount, not the raw subtotal', () => {
    const totals = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], {
      discountPercent: 10,
      taxPercent: 10,
    });
    // subtotal 100, discount 10 -> taxable 90, tax 9 -> total 99
    expect(totals).toEqual({ subtotal: 100, discountAmount: 10, taxAmount: 9, total: 99 });
  });

  it('rounds to 2 decimal places for fractional cent amounts', () => {
    const totals = calculateInvoiceTotals([{ quantity: 3, unitPrice: 10.005 }], { taxPercent: 8.25 });
    expect(totals.subtotal).toBe(30.02);
    expect(Number.isInteger(totals.total * 100)).toBe(true);
  });

  it('handles multiple line items with mixed quantities', () => {
    const totals = calculateInvoiceTotals([
      { quantity: 2, unitPrice: 15.5 },
      { quantity: 3, unitPrice: 4.25 },
      { quantity: 1, unitPrice: 99.99 },
    ]);
    expect(totals.subtotal).toBe(143.74);
  });

  it('returns zero totals for an empty line item list', () => {
    expect(calculateInvoiceTotals([])).toEqual({ subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 });
  });
});
