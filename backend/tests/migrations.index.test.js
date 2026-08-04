import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createConnection } from '../src/db/connection.js';
import { migrateUp, migrateDown, appliedMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/migrations/index.js';

describe('full migration registry', () => {
  let db;

  beforeEach(() => {
    db = createConnection(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('applies every registered migration in order', () => {
    migrateUp(db, migrations);

    expect(appliedMigrations(db)).toEqual([
      '001_create_patients',
      '002_create_scheduling',
      '003_add_doctor_location',
      '004_create_billing',
    ]);
  });

  it('creates all scheduling tables with the expected columns', () => {
    migrateUp(db, migrations);

    const tableInfo = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

    expect(tableInfo('doctors')).toEqual(
      expect.arrayContaining(['id', 'name', 'department', 'slot_duration_minutes', 'buffer_minutes', 'location']),
    );
    expect(tableInfo('doctor_working_hours')).toEqual(
      expect.arrayContaining(['id', 'doctor_id', 'day_of_week', 'start_time', 'end_time']),
    );
    expect(tableInfo('doctor_leave')).toEqual(
      expect.arrayContaining(['id', 'doctor_id', 'leave_date', 'reason']),
    );
    expect(tableInfo('holidays')).toEqual(expect.arrayContaining(['id', 'holiday_date', 'name']));
    expect(tableInfo('appointments')).toEqual(
      expect.arrayContaining([
        'id',
        'patient_id',
        'doctor_id',
        'appointment_date',
        'start_time',
        'end_time',
        'status',
        'created_at',
        'updated_at',
      ]),
    );
    expect(tableInfo('invoices')).toEqual(
      expect.arrayContaining([
        'id',
        'patient_id',
        'idempotency_key',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'total',
        'status',
        'amount_paid',
        'created_at',
        'updated_at',
      ]),
    );
    expect(tableInfo('invoice_line_items')).toEqual(
      expect.arrayContaining(['id', 'invoice_id', 'description', 'quantity', 'unit_price', 'amount']),
    );
  });

  it('rolls migrations back newest-first, in reverse order', () => {
    migrateUp(db, migrations);

    expect(migrateDown(db, migrations)).toBe('004_create_billing');
    expect(appliedMigrations(db)).toEqual([
      '001_create_patients',
      '002_create_scheduling',
      '003_add_doctor_location',
    ]);

    expect(migrateDown(db, migrations)).toBe('003_add_doctor_location');
    expect(appliedMigrations(db)).toEqual(['001_create_patients', '002_create_scheduling']);

    expect(migrateDown(db, migrations)).toBe('002_create_scheduling');
    expect(appliedMigrations(db)).toEqual(['001_create_patients']);

    expect(migrateDown(db, migrations)).toBe('001_create_patients');
    expect(appliedMigrations(db)).toEqual([]);
  });
});
