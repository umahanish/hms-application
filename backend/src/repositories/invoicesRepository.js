import { calculateInvoiceTotals, round2 } from '../services/invoiceCalculator.js';

function toInvoice(row, lineItemRows) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    idempotencyKey: row.idempotency_key,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    total: row.total,
    status: row.status,
    amountPaid: row.amount_paid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineItems: lineItemRows.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unit_price,
      amount: li.amount,
    })),
  };
}

function getLineItemRows(db, invoiceId) {
  return db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY id').all(invoiceId);
}

export function findInvoiceById(db, id) {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  return row ? toInvoice(row, getLineItemRows(db, id)) : null;
}

export function findInvoicesByPatient(db, patientId) {
  const rows = db.prepare('SELECT * FROM invoices WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
  return rows.map((row) => toInvoice(row, getLineItemRows(db, row.id)));
}

/**
 * Creates an invoice from line items, computing subtotal/discount/tax/total.
 * When an idempotencyKey is supplied and already in use, returns the existing
 * invoice instead of creating a duplicate. The lookup and insert run inside a
 * single synchronous transaction, so two requests with the same key can't race
 * their way into two invoices.
 */
export function createInvoice(db, { patientId, lineItems, discountPercent = 0, taxPercent = 0, idempotencyKey }) {
  return db.transaction(() => {
    if (idempotencyKey) {
      const existing = db.prepare('SELECT id FROM invoices WHERE idempotency_key = ?').get(idempotencyKey);
      if (existing) {
        return { invoice: findInvoiceById(db, existing.id), wasExisting: true };
      }
    }

    const totals = calculateInvoiceTotals(lineItems, { discountPercent, taxPercent });

    const result = db
      .prepare(
        `INSERT INTO invoices (patient_id, idempotency_key, subtotal, discount_amount, tax_amount, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(patientId, idempotencyKey ?? null, totals.subtotal, totals.discountAmount, totals.taxAmount, totals.total);

    const invoiceId = result.lastInsertRowid;
    const insertLineItem = db.prepare(
      'INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)',
    );
    for (const item of lineItems) {
      insertLineItem.run(invoiceId, item.description, item.quantity, item.unitPrice, round2(item.quantity * item.unitPrice));
    }

    return { invoice: findInvoiceById(db, invoiceId), wasExisting: false };
  })();
}

export function updateInvoiceStatus(db, id, status) {
  const existing = db.prepare('SELECT id FROM invoices WHERE id = ?').get(id);
  if (!existing) return null;

  db.prepare(
    `UPDATE invoices SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(status, id);

  return findInvoiceById(db, id);
}
