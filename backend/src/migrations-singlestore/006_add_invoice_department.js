export const id = '006_add_invoice_department';

export async function up(pool) {
  await pool.query('ALTER TABLE invoices ADD COLUMN department VARCHAR(100);');
}

export async function down(pool) {
  await pool.query('ALTER TABLE invoices DROP COLUMN department;');
}
