export const id = '004_create_billing';

export function up(db) {
  db.exec(`
    CREATE TABLE invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      idempotency_key TEXT UNIQUE,
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | partial | paid
      amount_paid REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE invoice_line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL
    );

    CREATE INDEX idx_invoices_patient ON invoices (patient_id);
    CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items (invoice_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_invoice_line_items_invoice;
    DROP INDEX IF EXISTS idx_invoices_patient;
    DROP TABLE IF EXISTS invoice_line_items;
    DROP TABLE IF EXISTS invoices;
  `);
}
