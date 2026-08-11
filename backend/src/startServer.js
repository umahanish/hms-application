import { pool as defaultPool, pingDatabase as defaultPing } from './db/pool.js';
import { createApp } from './app.js';

/**
 * Verifies the DB connection and starts listening. Deps are injectable for testing.
 *
 * Deliberately does NOT run schema migrations: the app connects as a least-privilege,
 * DML-only DB user (see backend/db/setup/create_app_user.sql), which can't run CREATE
 * TABLE. Migrations are a separate, elevated-privilege step -- run `npm run migrate`
 * (backend/src/runMigrations.js) with admin credentials before starting the app.
 */
export async function startServer({ port = process.env.PORT ?? 4000, dbPool = defaultPool, ping = defaultPing } = {}) {
  await ping();

  const app = createApp(dbPool);
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`HMS backend listening on port ${port}`);
      resolve(server);
    });
  });
}
