export const id = '002_create_scheduling';

export function up(db) {
  db.exec(`
    CREATE TABLE doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
      buffer_minutes INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE doctor_working_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id),
      day_of_week INTEGER NOT NULL, -- 0 = Sunday .. 6 = Saturday
      start_time TEXT NOT NULL,     -- 'HH:MM'
      end_time TEXT NOT NULL
    );

    CREATE TABLE doctor_leave (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id),
      leave_date TEXT NOT NULL,     -- 'YYYY-MM-DD'
      reason TEXT
    );

    CREATE TABLE holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      holiday_date TEXT NOT NULL UNIQUE, -- 'YYYY-MM-DD', hospital-wide
      name TEXT
    );

    CREATE TABLE appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      doctor_id INTEGER NOT NULL REFERENCES doctors(id),
      appointment_date TEXT NOT NULL, -- 'YYYY-MM-DD'
      start_time TEXT NOT NULL,       -- 'HH:MM'
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'booked', -- booked | cancelled
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX idx_doctor_working_hours_doctor ON doctor_working_hours (doctor_id, day_of_week);
    CREATE INDEX idx_doctor_leave_doctor_date ON doctor_leave (doctor_id, leave_date);
    CREATE INDEX idx_appointments_doctor_date ON appointments (doctor_id, appointment_date);
    CREATE INDEX idx_appointments_patient ON appointments (patient_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_appointments_patient;
    DROP INDEX IF EXISTS idx_appointments_doctor_date;
    DROP INDEX IF EXISTS idx_doctor_leave_doctor_date;
    DROP INDEX IF EXISTS idx_doctor_working_hours_doctor;
    DROP TABLE IF EXISTS appointments;
    DROP TABLE IF EXISTS holidays;
    DROP TABLE IF EXISTS doctor_leave;
    DROP TABLE IF EXISTS doctor_working_hours;
    DROP TABLE IF EXISTS doctors;
  `);
}
