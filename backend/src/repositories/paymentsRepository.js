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

export async function findPaymentById(pool, id) {
  const [rows] = await pool.execute('SELECT * FROM payments WHERE id = ?', [id]);
  return toPayment(rows[0]);
}

export async function findPaymentsByInvoice(pool, invoiceId) {
  const [rows] = await pool.execute('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at', [
    invoiceId,
  ]);
  return rows.map(toPayment);
}

function invoiceStatusFor(amountPaid, total) {
  if (amountPaid >= total) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

/** Locks the invoice row (must run inside an open transaction on `connection`) before applying a payment amount. */
async function applyPaymentToInvoice(connection, invoiceId, amount) {
  const [rows] = await connection.execute('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
  const invoice = rows[0];
  const newAmountPaid = round2(invoice.amount_paid + amount);
  const newStatus = invoiceStatusFor(newAmountPaid, invoice.total);
  const now = new Date().toISOString();

  await connection.execute('UPDATE invoices SET amount_paid = ?, status = ?, updated_at = ? WHERE id = ?', [
    newAmountPaid,
    newStatus,
    now,
    invoiceId,
  ]);
}

/** Records a successful payment and applies it to the invoice's amount_paid/status atomically. */
export async function recordSucceededPayment(pool, { invoiceId, amount, method, gatewayReference }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const now = new Date().toISOString();
    const [result] = await connection.execute(
      `INSERT INTO payments (invoice_id, amount, method, gateway_reference, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'succeeded', ?, ?)`,
      [invoiceId, amount, method, gatewayReference ?? null, now, now],
    );

    await applyPaymentToInvoice(connection, invoiceId, amount);

    await connection.commit();
    return await findPaymentById(pool, result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Records a payment awaiting async gateway confirmation; the invoice is not touched until the webhook resolves it. */
export async function recordPendingPayment(pool, { invoiceId, amount, method, gatewayReference }) {
  const now = new Date().toISOString();
  const [result] = await pool.execute(
    `INSERT INTO payments (invoice_id, amount, method, gateway_reference, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [invoiceId, amount, method, gatewayReference ?? null, now, now],
  );

  return findPaymentById(pool, result.insertId);
}

export async function recordFailedPayment(pool, { invoiceId, amount, method, gatewayReference, failureReason }) {
  const now = new Date().toISOString();
  const [result] = await pool.execute(
    `INSERT INTO payments (invoice_id, amount, method, gateway_reference, status, failure_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'failed', ?, ?, ?)`,
    [invoiceId, amount, method, gatewayReference ?? null, failureReason ?? null, now, now],
  );

  return findPaymentById(pool, result.insertId);
}

/**
 * Resolves a pending payment from an async webhook/callback: on success, applies
 * it to the invoice; on failure, marks it failed. Returns null if no pending
 * payment matches the gateway reference (already resolved, or unknown). Locks the
 * payment row first so two concurrent webhook deliveries can't double-apply it.
 */
export async function reconcilePendingPayment(pool, gatewayReference, { status, failureReason }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT * FROM payments WHERE gateway_reference = ? AND status = 'pending' FOR UPDATE`,
      [gatewayReference],
    );
    const row = rows[0];
    if (!row) {
      await connection.commit();
      return null;
    }

    const now = new Date().toISOString();
    if (status === 'succeeded') {
      await connection.execute(`UPDATE payments SET status = 'succeeded', updated_at = ? WHERE id = ?`, [
        now,
        row.id,
      ]);
      await applyPaymentToInvoice(connection, row.invoice_id, row.amount);
    } else {
      await connection.execute(
        `UPDATE payments SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?`,
        [failureReason ?? null, now, row.id],
      );
    }

    await connection.commit();
    return await findPaymentById(pool, row.id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
