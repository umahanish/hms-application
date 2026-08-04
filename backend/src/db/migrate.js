function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
}

function appliedIds(db) {
  ensureMigrationsTable(db);
  return new Set(db.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id));
}

/** Applies every migration that hasn't run yet, in registry order. */
export function migrateUp(db, migrations) {
  const applied = appliedIds(db);
  const insert = db.prepare('INSERT INTO schema_migrations (id) VALUES (?)');

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.transaction(() => {
      migration.up(db);
      insert.run(migration.id);
    })();
  }
}

/** Rolls back the most recently applied migration. Returns its id, or null if nothing to roll back. */
export function migrateDown(db, migrations) {
  const applied = appliedIds(db);
  const remove = db.prepare('DELETE FROM schema_migrations WHERE id = ?');

  for (let i = migrations.length - 1; i >= 0; i -= 1) {
    const migration = migrations[i];
    if (!applied.has(migration.id)) continue;
    db.transaction(() => {
      migration.down(db);
      remove.run(migration.id);
    })();
    return migration.id;
  }

  return null;
}

export function appliedMigrations(db) {
  return Array.from(appliedIds(db));
}
