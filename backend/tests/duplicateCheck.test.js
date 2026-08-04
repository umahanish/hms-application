import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createConnection } from '../src/db/connection.js';
import { migrateUp } from '../src/db/migrate.js';
import { migrations } from '../src/migrations/index.js';
import { findDuplicates } from '../src/services/duplicateCheck.js';

function insertPatient(db, overrides = {}) {
  const patient = {
    first_name: 'Jane',
    last_name: 'Doe',
    dob: '1990-01-01',
    gender: 'female',
    phone: '555-123-4567',
    email: 'jane.doe@example.com',
    address_line1: '123 Main St',
    city: 'Springfield',
    emergency_contact_name: 'John Doe',
    emergency_contact_phone: '555-987-6543',
    insurance_provider: 'Acme Health',
    insurance_policy_number: 'POL-12345',
    ...overrides,
  };

  const result = db
    .prepare(
      `INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address_line1, city,
        emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number)
       VALUES (@first_name, @last_name, @dob, @gender, @phone, @email, @address_line1, @city,
        @emergency_contact_name, @emergency_contact_phone, @insurance_provider, @insurance_policy_number)`,
    )
    .run(patient);

  return result.lastInsertRowid;
}

describe('findDuplicates', () => {
  let db;

  beforeEach(() => {
    db = createConnection(':memory:');
    migrateUp(db, migrations);
  });

  afterEach(() => {
    db.close();
  });

  it('returns no matches when there are no patients', () => {
    const matches = findDuplicates(db, { firstName: 'Jane', lastName: 'Doe', dob: '1990-01-01', phone: '555-123-4567' });
    expect(matches).toEqual([]);
  });

  it('flags an exact name + DOB + phone match', () => {
    insertPatient(db);

    const matches = findDuplicates(db, {
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1990-01-01',
      phone: '555-123-4567',
    });

    expect(matches).toHaveLength(1);
  });

  it('matches regardless of case and phone formatting differences', () => {
    insertPatient(db);

    const matches = findDuplicates(db, {
      firstName: 'JANE',
      lastName: 'doe',
      dob: '1990-01-01',
      phone: '(555) 123-4567',
    });

    expect(matches).toHaveLength(1);
  });

  it('does not flag patients with a different date of birth', () => {
    insertPatient(db);

    const matches = findDuplicates(db, {
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1991-01-01',
      phone: '555-123-4567',
    });

    expect(matches).toEqual([]);
  });

  it('does not flag patients whose name or phone differ', () => {
    insertPatient(db);

    const matches = findDuplicates(db, {
      firstName: 'Janet',
      lastName: 'Doe',
      dob: '1990-01-01',
      phone: '555-123-4567',
    });

    expect(matches).toEqual([]);
  });

  it('excludes a given patient id, e.g. when updating that same record', () => {
    const id = insertPatient(db);

    const matches = findDuplicates(
      db,
      { firstName: 'Jane', lastName: 'Doe', dob: '1990-01-01', phone: '555-123-4567' },
      { excludeId: id },
    );

    expect(matches).toEqual([]);
  });
});
