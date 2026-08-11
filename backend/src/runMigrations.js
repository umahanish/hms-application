import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { migrateUp } from './db/migrateSingleStore.js';
import { migrations } from './migrations-singlestore/index.js';

dotenv.config();

/**
 * Standalone migration runner, deliberately separate from the app's normal boot path
 * (see startServer.js): schema changes need CREATE/ALTER/DROP privileges, which the
 * app's runtime DB user does not have (least-privilege, DML-only -- see
 * backend/db/setup/create_app_user.sql). Run this manually with elevated credentials
 * before starting the app against a fresh database, or after adding new migrations.
 *
 * Uses DB_ADMIN_USER/DB_ADMIN_PASSWORD if set, otherwise falls back to DB_USER/
 * DB_PASSWORD (e.g. for a local dev DB where privileges aren't split).
 */
const adminPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_ADMIN_USER ?? process.env.DB_USER,
  password: process.env.DB_ADMIN_PASSWORD ?? process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

try {
  await migrateUp(adminPool, migrations);
  console.log('Migrations applied successfully.');
} finally {
  await adminPool.end();
}
