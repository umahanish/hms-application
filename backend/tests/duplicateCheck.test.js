import { describe, expect, it, beforeEach } from 'vitest';
import { createFakePool } from './helpers/fakePool.js';
import { migrateUp } from '../src/db/migrateSingleStore.js';
import { migrations } from '../src/migrations-singlestore/index.js';
import { findDuplicates } from '../src/services/duplicateCheck.js';

async function insertPatient(pool, overrides = {}) {
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
  const now = new Date().toISOString();

  const [result] = await pool.execute(
    `INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address_line1, city,
      emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patient.first_name,
      patient.last_name,
      patient.dob,
      patient.gender,
      patient.phone,
      patient.email,
      patient.address_line1,
      patient.city,
      patient.emergency_contact_name,
      patient.emergency_contact_phone,
      patient.insurance_provider,
      patient.insurance_policy_number,
      now,
      now,
    ],
  );

  return result.insertId;
}

describe('findDuplicates', () => {
  let pool;

  beforeEach(async () => {
    pool = createFakePool();
    await migrateUp(pool, migrations);
  });

  it('returns no matches when there are no patients', async () => {
    const matches = await findDuplicates(pool, {
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1990-01-01',
      phone: '555-123-4567',
    });
    expect(matches).toEqual([]);
  });

  it('flags an exact name + DOB + phone match', async () => {
    await insertPatient(pool);

    const matches = await findDuplicates(pool, {
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1990-01-01',
      phone: '555-123-4567',
    });

    expect(matches).toHaveLength(1);
  });

  it('matches regardless of case and phone formatting differences', async () => {
    await insertPatient(pool);

    const matches = await findDuplicates(pool, {
      firstName: 'JANE',
      lastName: 'doe',
      dob: '1990-01-01',
      phone: '(555) 123-4567',
    });

    expect(matches).toHaveLength(1);
  });

  it('does not flag patients with a different date of birth', async () => {
    await insertPatient(pool);

    const matches = await findDuplicates(pool, {
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1991-01-01',
      phone: '555-123-4567',
    });

    expect(matches).toEqual([]);
  });

  it('does not flag patients whose name or phone differ', async () => {
    await insertPatient(pool);

    const matches = await findDuplicates(pool, {
      firstName: 'Janet',
      lastName: 'Doe',
      dob: '1990-01-01',
      phone: '555-123-4567',
    });

    expect(matches).toEqual([]);
  });

  it('excludes a given patient id, e.g. when updating that same record', async () => {
    const id = await insertPatient(pool);

    const matches = await findDuplicates(
      pool,
      { firstName: 'Jane', lastName: 'Doe', dob: '1990-01-01', phone: '555-123-4567' },
      { excludeId: id },
    );

    expect(matches).toEqual([]);
  });
});
