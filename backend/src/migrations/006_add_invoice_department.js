export const id = '006_add_invoice_department';

export function up(db) {
  db.exec('ALTER TABLE invoices ADD COLUMN department TEXT;');
}

export function down(db) {
  db.exec('ALTER TABLE invoices DROP COLUMN department;');
}
