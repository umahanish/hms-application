export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Live client-side preview of an invoice's totals, mirroring the backend's
 * calculation (discount applied to subtotal, tax applied post-discount) so
 * billing staff see the same numbers before submitting.
 */
export function calculateInvoiceTotals(lineItems, { discountPercent = 0, taxPercent = 0 } = {}) {
  const subtotal = round2(
    lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0),
  );
  const discountAmount = round2(subtotal * (discountPercent / 100));
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = round2(taxableAmount * (taxPercent / 100));
  const total = round2(taxableAmount + taxAmount);

  return { subtotal, discountAmount, taxAmount, total };
}
