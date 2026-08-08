import { round2 } from '../services/invoiceCalculator.js';

function toPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    amount: row.amount,
    method: row.method,
    gatewayReference: row.gateway_reference,
    status: row.status,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function findPaymentById(db, id) {
  return toPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
}

export function findPaymentsByInvoice(db, invoiceId) {
  return db
    .prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at')
    .all(invoiceId)
    .map(toPayment);
}

function invoiceStatusFor(amountPaid, total) {
  if (amountPaid >= total) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function applyPaymentToInvoice(db, invoiceId, amount) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  const newAmountPaid = round2(invoice.amount_paid + amount);
  const newStatus = invoiceStatusFor(newAmountPaid, invoice.total);

  db.prepare(
    `UPDATE invoices SET amount_paid = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(newAmountPaid, newStatus, invoiceId);
}

/** Records a successful payment and applies it to the invoice's amount_paid/status atomically. */
export function recordSucceededPayment(db, { invoiceId, amount, method, gatewayReference }) {
  return db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO payments (invoice_id, amount, method, gateway_reference, status)
         VALUES (?, ?, ?, ?, 'succeeded')`,
      )
      .run(invoiceId, amount, method, gatewayReference ?? null);

    applyPaymentToInvoice(db, invoiceId, amount);
    return findPaymentById(db, result.lastInsertRowid);
  })();
}

/** Records a payment awaiting async gateway confirmation; the invoice is not touched until the webhook resolves it. */
export function recordPendingPayment(db, { invoiceId, amount, method, gatewayReference }) {
  const result = db
    .prepare(
      `INSERT INTO payments (invoice_id, amount, method, gateway_reference, status)
       VALUES (?, ?, ?, ?, 'pending')`,
    )
    .run(invoiceId, amount, method, gatewayReference ?? null);

  return findPaymentById(db, result.lastInsertRowid);
}

export function recordFailedPayment(db, { invoiceId, amount, method, gatewayReference, failureReason }) {
  const result = db
    .prepare(
      `INSERT INTO payments (invoice_id, amount, method, gateway_reference, status, failure_reason)
       VALUES (?, ?, ?, ?, 'failed', ?)`,
    )
    .run(invoiceId, amount, method, gatewayReference ?? null, failureReason ?? null);

  return findPaymentById(db, result.lastInsertRowid);
}

/**
 * Resolves a pending payment from an async webhook/callback: on success, applies
 * it to the invoice; on failure, marks it failed. Returns null if no pending
 * payment matches the gateway reference (already resolved, or unknown).
 */
export function reconcilePendingPayment(db, gatewayReference, { status, failureReason }) {
  return db.transaction(() => {
    const row = db
      .prepare(`SELECT * FROM payments WHERE gateway_reference = ? AND status = 'pending'`)
      .get(gatewayReference);
    if (!row) return null;

    if (status === 'succeeded') {
      db.prepare(
        `UPDATE payments SET status = 'succeeded', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      ).run(row.id);
      applyPaymentToInvoice(db, row.invoice_id, row.amount);
    } else {
      db.prepare(
        `UPDATE payments SET status = 'failed', failure_reason = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      ).run(failureReason ?? null, row.id);
    }

    return findPaymentById(db, row.id);
  })();
}
