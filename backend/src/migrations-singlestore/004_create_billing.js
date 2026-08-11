export const id = '004_create_billing';

export async function up(pool) {
  // idempotency_key is stored here for display/audit but NOT constrained unique on this
  // table: SingleStore requires a UNIQUE KEY to be a superset of the shard key (id here),
  // and idempotency_key is nullable so it can't just be folded into the primary key either.
  // Uniqueness is instead enforced via the invoice_idempotency_keys guard table (migration 008).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT NOT NULL,
      idempotency_key VARCHAR(255),
      subtotal DECIMAL(12,2) NOT NULL,
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      total DECIMAL(12,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
      amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL,
      KEY idx_invoices_patient (patient_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      invoice_id BIGINT NOT NULL,
      description VARCHAR(255) NOT NULL,
      quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
      unit_price DECIMAL(12,2) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      KEY idx_invoice_line_items_invoice (invoice_id)
    );
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS invoice_line_items;');
  await pool.query('DROP TABLE IF EXISTS invoices;');
}
