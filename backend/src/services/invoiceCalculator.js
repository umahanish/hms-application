export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Computes subtotal, discount, tax, and total for an invoice from its line items.
 * Discount is applied to the subtotal; tax is applied to the post-discount amount.
 */
export function calculateInvoiceTotals(lineItems, { discountPercent = 0, taxPercent = 0 } = {}) {
  const subtotal = round2(lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const discountAmount = round2(subtotal * (discountPercent / 100));
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = round2(taxableAmount * (taxPercent / 100));
  const total = round2(taxableAmount + taxAmount);

  return { subtotal, discountAmount, taxAmount, total };
}
