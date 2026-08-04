export const id = '001_create_patients';

export function up(db) {
  db.exec(`
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dob TEXT NOT NULL,
      gender TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city TEXT NOT NULL,
      state TEXT,
      zip TEXT,
      emergency_contact_name TEXT NOT NULL,
      emergency_contact_phone TEXT NOT NULL,
      insurance_provider TEXT NOT NULL,
      insurance_policy_number TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX idx_patients_name ON patients (last_name, first_name);
    CREATE INDEX idx_patients_dob ON patients (dob);
    CREATE INDEX idx_patients_phone ON patients (phone);
  `);
}

export function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_patients_phone;
    DROP INDEX IF EXISTS idx_patients_dob;
    DROP INDEX IF EXISTS idx_patients_name;
    DROP TABLE IF EXISTS patients;
  `);
}
