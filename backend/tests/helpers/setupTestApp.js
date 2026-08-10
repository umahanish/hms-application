import { createFakePool } from './fakePool.js';
import { migrateUp } from '../../src/db/migrateSingleStore.js';
import { migrations } from '../../src/migrations-singlestore/index.js';
import { createApp } from '../../src/app.js';

export async function setupTestApp() {
  const pool = createFakePool();
  await migrateUp(pool, migrations);
  const app = createApp(pool);
  return { pool, app };
}
