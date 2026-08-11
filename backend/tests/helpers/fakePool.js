/**
 * A minimal in-memory stand-in for the mysql2/promise pool, built to understand
 * exactly the query shapes this backend's repositories issue (plain equality/range
 * WHERE clauses joined by AND, a handful of literal values mixed with `?`
 * placeholders, ORDER BY, and the transaction/FOR UPDATE locking pattern used for
 * doctor-day and invoice/payment row locks). It is not a general SQL engine.
 *
 * FOR UPDATE is implemented as a real per-key async lock queue (not a no-op) so
 * that tests exercising concurrent requests (e.g. two simultaneous booking
 * attempts for the same slot) correctly serialize the way they do against a real
 * SingleStore connection, rather than racing past a fake conflict check.
 */

function parseLiteral(token, params, cursor) {
  const t = token.trim();
  if (t === '?') {
    return { value: params[cursor.i], consumed: true };
  }
  if (/^'.*'$/.test(t)) {
    return { value: t.slice(1, -1), consumed: false };
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return { value: Number(t), consumed: false };
  }
  if (t.toUpperCase() === 'NULL') {
    return { value: null, consumed: false };
  }
  return { value: t, consumed: false };
}

function nextValue(token, params, cursor) {
  const { value, consumed } = parseLiteral(token, params, cursor);
  if (consumed) cursor.i += 1;
  return value;
}

function splitCsvTopLevel(str) {
  return str.split(',').map((s) => s.trim());
}

function parseConditions(whereClause, params, cursor) {
  if (!whereClause || !whereClause.trim()) return [];
  return whereClause.split(/\s+AND\s+/i).map((raw) => {
    const match = raw.trim().match(/^(\S+)\s*(>=|<=|!=|=)\s*(.+)$/);
    const [, column, operator, valueToken] = match;
    return { column, operator, value: nextValue(valueToken, params, cursor) };
  });
}

function rowMatches(row, conditions) {
  return conditions.every(({ column, operator, value }) => {
    const rowValue = row[column];
    switch (operator) {
      case '>=':
        return rowValue >= value;
      case '<=':
        return rowValue <= value;
      case '!=':
        return rowValue !== value;
      default:
        return rowValue === value;
    }
  });
}

function parseOrderBy(orderByClause) {
  if (!orderByClause) return [];
  return splitCsvTopLevel(orderByClause).map((token) => {
    const desc = /\bDESC\b/i.test(token);
    const column = token.replace(/\bDESC\b|\bASC\b/gi, '').trim();
    return { column, desc };
  });
}

function sortRows(rows, orderBy) {
  if (orderBy.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { column, desc } of orderBy) {
      const av = a[column];
      const bv = b[column];
      if (av === bv) continue;
      const cmp = av > bv ? 1 : -1;
      return desc ? -cmp : cmp;
    }
    return 0;
  });
}

function searchPatients(store, params) {
  const like = params[0].slice(1, -1); // unwrap `%term%`
  const term = params[5];
  const rows = (store.tables.patients || []).filter((row) => {
    const first = String(row.first_name).toLowerCase();
    const last = String(row.last_name).toLowerCase();
    return (
      first.includes(like) ||
      last.includes(like) ||
      `${first} ${last}`.includes(like) ||
      String(row.phone).toLowerCase().includes(like) ||
      String(row.dob).toLowerCase().includes(like) ||
      String(row.id) === term
    );
  });
  return [sortRows(rows, [{ column: 'last_name' }, { column: 'first_name' }]), undefined];
}

function ensureTable(store, table) {
  if (!store.tables[table]) store.tables[table] = [];
  if (store.autoIncrement[table] == null) store.autoIncrement[table] = 0;
  return store.tables[table];
}

function runInsert(store, sql, params) {
  const match = sql.match(
    /INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)(?:\s*ON DUPLICATE KEY UPDATE\s+(.+))?/is,
  );
  const [, table, columnsRaw, valuesRaw, onDuplicate] = match;
  const columns = splitCsvTopLevel(columnsRaw);
  const valueTokens = splitCsvTopLevel(valuesRaw);
  const cursor = { i: 0 };
  const row = {};
  columns.forEach((col, idx) => {
    row[col] = nextValue(valueTokens[idx], params, cursor);
  });

  const rows = ensureTable(store, table);

  if (onDuplicate) {
    const existing = rows.find((r) => columns.every((col) => r[col] === row[col]));
    if (existing) {
      return [{ affectedRows: 1, insertId: existing.id ?? 0 }, undefined];
    }
  }

  // Only auto-assign an id when the statement didn't already supply one explicitly
  // (schema_migrations' PK is a caller-supplied string id, not an auto-increment).
  if (!columns.includes('id')) {
    store.autoIncrement[table] += 1;
    row.id = store.autoIncrement[table];
  }

  if (table === 'invoice_idempotency_keys') {
    const dup = rows.find((r) => r.idempotency_key === row.idempotency_key);
    if (dup) {
      const error = new Error('Duplicate entry for key idempotency_key');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }
  }
  if (table === 'holidays') {
    const dup = rows.find((r) => r.holiday_date === row.holiday_date);
    if (dup) {
      const error = new Error('Duplicate entry for key holiday_date');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }
  }

  rows.push(row);
  return [{ affectedRows: 1, insertId: row.id ?? 0 }, undefined];
}

function parseSelectColumns(sql) {
  const [, colsRaw] = sql.match(/^SELECT\s+(.+?)\s+FROM\s+/is);
  if (colsRaw.trim() === '*') return null; // null = full row, no projection
  return splitCsvTopLevel(colsRaw).map((token) => {
    const aliasMatch = token.match(/^(.+?)\s+as\s+(\w+)$/i);
    if (aliasMatch) return { source: aliasMatch[1].trim(), alias: aliasMatch[2].trim() };
    return { source: token, alias: token };
  });
}

function projectRow(row, columns) {
  if (!columns) return { ...row };
  const out = {};
  for (const { source, alias } of columns) {
    out[alias] = row[source];
  }
  return out;
}

function runSelect(store, sql, params) {
  if (/LOWER\(CONCAT\(first_name/i.test(sql)) {
    return searchPatients(store, params);
  }

  const table = sql.match(/FROM\s+(\w+)/i)[1];
  const columns = parseSelectColumns(sql);
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER BY|\s+FOR UPDATE|$)/is);
  const orderByMatch = sql.match(/ORDER BY\s+(.+?)(?:\s+FOR UPDATE|$)/is);

  const cursor = { i: 0 };
  const conditions = parseConditions(whereMatch ? whereMatch[1] : '', params, cursor);
  const rows = (store.tables[table] || []).filter((row) => rowMatches(row, conditions));
  const ordered = sortRows(rows, parseOrderBy(orderByMatch ? orderByMatch[1] : ''));

  return [ordered.map((row) => projectRow(row, columns)), undefined];
}

function runUpdate(store, sql, params) {
  const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/is);
  const [, table, setRaw, whereRaw] = match;
  const cursor = { i: 0 };

  const assignments = splitCsvTopLevel(setRaw).map((raw) => {
    const [, column, valueToken] = raw.match(/^(\S+)\s*=\s*(.+)$/);
    return { column, value: nextValue(valueToken, params, cursor) };
  });

  const conditions = parseConditions(whereRaw, params, cursor);
  const rows = ensureTable(store, table);
  let affectedRows = 0;

  for (const row of rows) {
    if (rowMatches(row, conditions)) {
      for (const { column, value } of assignments) {
        row[column] = value;
      }
      affectedRows += 1;
    }
  }

  return [{ affectedRows }, undefined];
}

function runDelete(store, sql, params) {
  const match = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)$/is);
  const [, table, whereRaw] = match;
  const cursor = { i: 0 };
  const conditions = parseConditions(whereRaw, params, cursor);
  const rows = ensureTable(store, table);
  const remaining = rows.filter((row) => !rowMatches(row, conditions));
  const affectedRows = rows.length - remaining.length;
  store.tables[table] = remaining;
  return [{ affectedRows }, undefined];
}

function runDDL(store, sql) {
  const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
  if (createMatch) {
    ensureTable(store, createMatch[1]);
    return [{}, undefined];
  }
  const dropMatch = sql.match(/DROP TABLE IF EXISTS (\w+)/i);
  if (dropMatch) {
    delete store.tables[dropMatch[1]];
    delete store.autoIncrement[dropMatch[1]];
    return [{}, undefined];
  }
  // ALTER TABLE ADD/DROP COLUMN: rows are schemaless plain objects, nothing to do.
  return [{}, undefined];
}

function runQuery(store, sql, params = []) {
  const statement = sql.trim();
  if (/^INSERT/i.test(statement)) return runInsert(store, statement, params);
  if (/^SELECT/i.test(statement)) return runSelect(store, statement, params);
  if (/^UPDATE/i.test(statement)) return runUpdate(store, statement, params);
  if (/^DELETE/i.test(statement)) return runDelete(store, statement, params);
  if (/^CREATE TABLE|^ALTER TABLE|^DROP TABLE/i.test(statement)) return runDDL(store, statement);
  throw new Error(`fakePool: unsupported statement: ${statement}`);
}

function releaseAllLocks(connection) {
  for (const release of connection.heldLocks.values()) release();
  connection.heldLocks.clear();
}

async function acquireRowLock(store, connection, key) {
  if (connection.heldLocks.has(key)) return;
  const tail = store.lockQueues.get(key) || Promise.resolve();
  let releaseFn;
  const myTurn = new Promise((resolve) => {
    releaseFn = resolve;
  });
  store.lockQueues.set(
    key,
    tail.then(() => myTurn),
  );
  await tail;
  connection.heldLocks.set(key, releaseFn);
}

class FakeConnection {
  constructor(pool) {
    this.pool = pool;
    this.heldLocks = new Map();
    this.snapshot = null;
  }

  async beginTransaction() {
    this.snapshot = structuredClone({
      tables: this.pool.store.tables,
      autoIncrement: this.pool.store.autoIncrement,
    });
  }

  async execute(sql, params = []) {
    if (/FOR UPDATE/i.test(sql)) {
      const lockKey = `${sql.replace(/FOR UPDATE/i, '').trim()}::${JSON.stringify(params)}`;
      await acquireRowLock(this.pool.store, this, lockKey);
    }
    return runQuery(this.pool.store, sql, params);
  }

  async query(sql) {
    return this.execute(sql, []);
  }

  async commit() {
    this.snapshot = null;
    releaseAllLocks(this);
  }

  async rollback() {
    if (this.snapshot) {
      this.pool.store.tables = this.snapshot.tables;
      this.pool.store.autoIncrement = this.snapshot.autoIncrement;
    }
    this.snapshot = null;
    releaseAllLocks(this);
  }

  release() {}
}

export function createFakePool() {
  const pool = {
    store: { tables: {}, autoIncrement: {}, lockQueues: new Map() },
    async execute(sql, params = []) {
      return runQuery(this.store, sql, params);
    },
    async query(sql) {
      return runQuery(this.store, sql, []);
    },
    async getConnection() {
      return new FakeConnection(pool);
    },
  };
  return pool;
}
