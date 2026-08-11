import { calculateInvoiceTotals, round2 } from '../services/invoiceCalculator.js';

function toInvoice(row, lineItemRows) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    department: row.department,
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

async function getLineItemRows(pool, invoiceId) {
  const [rows] = await pool.execute('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY id', [
    invoiceId,
  ]);
  return rows;
}

export async function findInvoiceById(pool, id) {
  const [rows] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [id]);
  const row = rows[0];
  return row ? toInvoice(row, await getLineItemRows(pool, id)) : null;
}

async function findInvoiceByIdempotencyKey(pool, idempotencyKey) {
  const [rows] = await pool.execute('SELECT invoice_id FROM invoice_idempotency_keys WHERE idempotency_key = ?', [
    idempotencyKey,
  ]);
  return rows[0] ? findInvoiceById(pool, rows[0].invoice_id) : null;
}

export async function findInvoicesByPatient(pool, patientId) {
  return findInvoices(pool, { patientId });
}

/** Lists invoices, optionally filtered by patient, status, created-date range, and/or department. */
export async function findInvoices(pool, { patientId, status, dateFrom, dateTo, department } = {}) {
  const clauses = [];
  const params = [];

  if (patientId != null) {
    clauses.push('patient_id = ?');
    params.push(patientId);
  }
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }
  if (dateFrom) {
    clauses.push('created_at >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    // created_at is an ISO-8601 string, not a DATE column, so pad to end-of-day for an inclusive dateTo.
    clauses.push('created_at <= ?');
    params.push(`${dateTo}T23:59:59.999Z`);
  }
  if (department) {
    clauses.push('department = ?');
    params.push(department);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.execute(`SELECT * FROM invoices ${where} ORDER BY created_at DESC`, params);
  return Promise.all(rows.map(async (row) => toInvoice(row, await getLineItemRows(pool, row.id))));
}

/**
 * Creates an invoice from line items, computing subtotal/discount/tax/total, inside
 * a transaction so the invoice row, its line items, and its idempotency-key guard row
 * are written atomically. When an idempotencyKey collides with an existing invoice
 * (UNIQUE constraint on invoice_idempotency_keys), the transaction rolls back and the
 * existing invoice is returned instead of a duplicate.
 */
export async function createInvoice(
  pool,
  { patientId, lineItems, discountPercent = 0, taxPercent = 0, idempotencyKey, department },
) {
  const totals = calculateInvoiceTotals(lineItems, { discountPercent, taxPercent });
  const now = new Date().toISOString();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO invoices (patient_id, department, idempotency_key, subtotal, discount_amount, tax_amount, total, status, amount_paid, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unpaid', 0, ?, ?)`,
      [
        patientId,
        department ?? null,
        idempotencyKey ?? null,
        totals.subtotal,
        totals.discountAmount,
        totals.taxAmount,
        totals.total,
        now,
        now,
      ],
    );
    const invoiceId = result.insertId;

    if (idempotencyKey) {
      await connection.execute(
        'INSERT INTO invoice_idempotency_keys (idempotency_key, invoice_id) VALUES (?, ?)',
        [idempotencyKey, invoiceId],
      );
    }

    const insertLineItemSql =
      'INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)';
    for (const item of lineItems) {
      await connection.execute(insertLineItemSql, [
        invoiceId,
        item.description,
        item.quantity,
        item.unitPrice,
        round2(item.quantity * item.unitPrice),
      ]);
    }

    await connection.commit();
    return { invoice: await findInvoiceById(pool, invoiceId), wasExisting: false };
  } catch (error) {
    await connection.rollback();
    if (idempotencyKey && error.code === 'ER_DUP_ENTRY') {
      const existing = await findInvoiceByIdempotencyKey(pool, idempotencyKey);
      if (existing) {
        return { invoice: existing, wasExisting: true };
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateInvoiceStatus(pool, id, status) {
  const [existingRows] = await pool.execute('SELECT id FROM invoices WHERE id = ?', [id]);
  if (!existingRows[0]) return null;

  const now = new Date().toISOString();
  await pool.execute('UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);

  return findInvoiceById(pool, id);
}
