import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createConnection } from '../src/db/connection.js';
import { migrateUp, migrateDown, appliedMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/migrations/index.js';

describe('migrations', () => {
  let db;

  beforeEach(() => {
    db = createConnection(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates the patients table with all schema columns on migrateUp', () => {
    migrateUp(db, migrations);

    const columns = db.prepare('PRAGMA table_info(patients)').all().map((col) => col.name);

    for (const expected of [
      'id',
      'first_name',
      'last_name',
      'dob',
      'gender',
      'phone',
      'email',
      'address_line1',
      'address_line2',
      'city',
      'state',
      'zip',
      'emergency_contact_name',
      'emergency_contact_phone',
      'insurance_provider',
      'insurance_policy_number',
      'created_at',
      'updated_at',
    ]) {
      expect(columns).toContain(expected);
    }
  });

  it('records applied migrations and is idempotent', () => {
    migrateUp(db, migrations);
    migrateUp(db, migrations); // running again should not error or duplicate

    expect(appliedMigrations(db)).toEqual(['001_create_patients']);
  });

  it('enforces NOT NULL constraints on required demographic and contact fields', () => {
    migrateUp(db, migrations);

    expect(() => {
      db.prepare(
        `INSERT INTO patients (first_name, dob, gender, phone, email, address_line1, city,
          emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number)
         VALUES ('Jane', '1990-01-01', 'female', '555-1234', 'jane@example.com', '123 Main St', 'Springfield',
          'John', '555-9999', 'Acme', 'POL-1')`,
      ).run();
    }).toThrow(/NOT NULL constraint failed: patients.last_name/);
  });

  it('allows a fully-populated insert to succeed', () => {
    migrateUp(db, migrations);

    const result = db
      .prepare(
        `INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address_line1, city,
          emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number)
         VALUES ('Jane', 'Doe', '1990-01-01', 'female', '555-1234', 'jane@example.com', '123 Main St', 'Springfield',
          'John', '555-9999', 'Acme', 'POL-1')`,
      )
      .run();

    expect(result.changes).toBe(1);
  });

  it('reverses the migration on migrateDown, dropping the patients table', () => {
    migrateUp(db, migrations);
    const rolledBackId = migrateDown(db, migrations);

    expect(rolledBackId).toBe('001_create_patients');
    expect(appliedMigrations(db)).toEqual([]);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patients'")
      .all();
    expect(tables).toEqual([]);
  });

  it('returns null from migrateDown when there is nothing to roll back', () => {
    expect(migrateDown(db, migrations)).toBeNull();
  });

  it('can be re-applied after a rollback', () => {
    migrateUp(db, migrations);
    migrateDown(db, migrations);
    migrateUp(db, migrations);

    expect(appliedMigrations(db)).toEqual(['001_create_patients']);
  });
});
