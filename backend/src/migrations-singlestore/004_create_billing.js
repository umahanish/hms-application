export const id = '004_create_billing';

export async function up(pool) {
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
      UNIQUE KEY uq_invoices_idempotency_key (idempotency_key),
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
