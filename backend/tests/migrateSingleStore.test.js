import { describe, expect, it, beforeEach } from 'vitest';
import { createFakePool } from './helpers/fakePool.js';
import { migrateUp, migrateDown, appliedMigrations } from '../src/db/migrateSingleStore.js';
import { migrations } from '../src/migrations-singlestore/index.js';

const MIGRATION_IDS = [
  '001_create_patients',
  '002_create_scheduling',
  '003_add_doctor_location',
  '004_create_billing',
  '005_create_payments',
  '006_add_invoice_department',
  '007_create_doctor_day_locks',
];

describe('SingleStore migration registry', () => {
  let pool;

  beforeEach(() => {
    pool = createFakePool();
  });

  it('applies every registered migration in order', async () => {
    await migrateUp(pool, migrations);
    expect(await appliedMigrations(pool)).toEqual(expect.arrayContaining(MIGRATION_IDS));
  });

  it('creates every table used by the app', async () => {
    await migrateUp(pool, migrations);

    for (const table of [
      'patients',
      'doctors',
      'doctor_working_hours',
      'doctor_leave',
      'holidays',
      'appointments',
      'invoices',
      'invoice_line_items',
      'payments',
      'doctor_day_locks',
    ]) {
      expect(pool.store.tables[table]).toBeDefined();
    }
  });

  it('is idempotent: running migrateUp twice does not error or duplicate entries', async () => {
    await migrateUp(pool, migrations);
    await migrateUp(pool, migrations);

    expect(await appliedMigrations(pool)).toHaveLength(MIGRATION_IDS.length);
  });

  it('rolls migrations back newest-first, in reverse order', async () => {
    await migrateUp(pool, migrations);

    expect(await migrateDown(pool, migrations)).toBe('007_create_doctor_day_locks');
    expect(await migrateDown(pool, migrations)).toBe('006_add_invoice_department');

    const remaining = await appliedMigrations(pool);
    expect(remaining).not.toContain('007_create_doctor_day_locks');
    expect(remaining).not.toContain('006_add_invoice_department');
    expect(remaining).toContain('001_create_patients');
  });

  it('returns null from migrateDown when there is nothing to roll back', async () => {
    expect(await migrateDown(pool, [])).toBeNull();
  });

  it('can be re-applied after a rollback', async () => {
    await migrateUp(pool, migrations);
    await migrateDown(pool, migrations);
    await migrateUp(pool, migrations);

    expect(await appliedMigrations(pool)).toEqual(expect.arrayContaining(MIGRATION_IDS));
  });
});
