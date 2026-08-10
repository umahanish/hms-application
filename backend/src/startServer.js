import { pool as defaultPool, pingDatabase as defaultPing } from './db/pool.js';
import { migrateUp as defaultMigrateUp } from './db/migrateSingleStore.js';
import { migrations } from './migrations-singlestore/index.js';
import { createApp } from './app.js';

/** Verifies the DB connection, applies pending migrations, and starts listening. Deps are injectable for testing. */
export async function startServer({
  port = process.env.PORT ?? 4000,
  dbPool = defaultPool,
  ping = defaultPing,
  applyMigrations = defaultMigrateUp,
} = {}) {
  await ping();
  await applyMigrations(dbPool, migrations);

  const app = createApp(dbPool);
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`HMS backend listening on port ${port}`);
      resolve(server);
    });
  });
}
