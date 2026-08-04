export const id = '005_create_payments';

export function up(db) {
  db.exec(`
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      amount REAL NOT NULL,
      method TEXT NOT NULL, -- card | upi | cash
      gateway_reference TEXT,
      status TEXT NOT NULL, -- pending | succeeded | failed
      failure_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX idx_payments_invoice ON payments (invoice_id);
    CREATE INDEX idx_payments_gateway_reference ON payments (gateway_reference);
  `);
}

export function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_payments_gateway_reference;
    DROP INDEX IF EXISTS idx_payments_invoice;
    DROP TABLE IF EXISTS payments;
  `);
}
