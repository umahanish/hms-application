async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at VARCHAR(30) NOT NULL
    );
  `);
}

async function appliedIds(pool) {
  await ensureMigrationsTable(pool);
  const [rows] = await pool.query('SELECT id FROM schema_migrations');
  return new Set(rows.map((row) => row.id));
}

/**
 * Applies every migration that hasn't run yet, in registry order. DDL statements
 * are not transactional on SingleStore, so each migration's up() must be safe to
 * re-run partially (CREATE TABLE IF NOT EXISTS / IF NOT EXISTS guards) in case a
 * later statement in the same migration fails.
 */
export async function migrateUp(pool, migrations) {
  const applied = await appliedIds(pool);

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    await migration.up(pool);
    await pool.execute('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [
      migration.id,
      new Date().toISOString(),
    ]);
  }
}

/** Rolls back the most recently applied migration. Returns its id, or null if nothing to roll back. */
export async function migrateDown(pool, migrations) {
  const applied = await appliedIds(pool);

  for (let i = migrations.length - 1; i >= 0; i -= 1) {
    const migration = migrations[i];
    if (!applied.has(migration.id)) continue;
    await migration.down(pool);
    await pool.execute('DELETE FROM schema_migrations WHERE id = ?', [migration.id]);
    return migration.id;
  }

  return null;
}

export async function appliedMigrations(pool) {
  const applied = await appliedIds(pool);
  return Array.from(applied);
}
