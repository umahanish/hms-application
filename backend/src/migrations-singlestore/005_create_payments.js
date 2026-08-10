export const id = '005_create_payments';

export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      invoice_id BIGINT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      method VARCHAR(20) NOT NULL,
      gateway_reference VARCHAR(255),
      status VARCHAR(20) NOT NULL,
      failure_reason VARCHAR(500),
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL,
      KEY idx_payments_invoice (invoice_id),
      KEY idx_payments_gateway_reference (gateway_reference)
    );
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS payments;');
}
