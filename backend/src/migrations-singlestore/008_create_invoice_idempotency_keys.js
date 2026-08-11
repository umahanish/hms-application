/**
 * Enforces invoice idempotency-key uniqueness via a dedicated single-column-PK guard
 * table, since SingleStore won't allow a UNIQUE KEY on invoices.idempotency_key
 * directly (it's nullable, and can't be folded into the id-based shard key). Only rows
 * for invoices actually created with an idempotencyKey exist here.
 */
export const id = '008_create_invoice_idempotency_keys';

export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_idempotency_keys (
      idempotency_key VARCHAR(255) PRIMARY KEY,
      invoice_id BIGINT NOT NULL
    );
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS invoice_idempotency_keys;');
}
