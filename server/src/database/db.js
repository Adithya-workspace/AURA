import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import Database from 'libsql';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

let handle = null;

function resolveDbPath() {
  const configured = env.AURA_DB_PATH;
  if (path.isAbsolute(configured)) return configured;
  const fromCwd = path.resolve(process.cwd(), configured);
  return fromCwd;
}

function wrapBetter(db) {
  return {
    kind: 'better-sqlite3',
    exec(sql) {
      db.exec(sql);
    },
    run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
  };
}

function wrapLibsql(db) {
  return {
    kind: 'libsql',
    exec(sql) {
      db.exec(sql);
    },
    run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
  };
}

async function wrapSqlJs(dbPath) {
  const initSqlJs = (await import('sql.js')).default;
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  const save = () => {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  };
  const all = (sql, params = []) => {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };
  return {
    kind: 'sql.js',
    exec(sql) {
      db.exec(sql);
      save();
    },
    run(sql, params = []) {
      db.run(sql, params);
      save();
    },
    all,
    get(sql, params = []) {
      return all(sql, params)[0];
    },
  };
}

export async function initDb() {
  if (handle) return handle;
  const tursoUrl = env.TURSO_DATABASE_URL?.trim();
  const tursoToken = env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl) {
    const db = new Database(tursoUrl, { authToken: tursoToken || undefined });
    handle = wrapLibsql(db);
    log('info', `sqlite engine libsql at ${tursoUrl}`);
  } else {
    const dbPath = resolveDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    try {
      const BetterSqlite = require('better-sqlite3');
      const db = new BetterSqlite(dbPath);
      db.pragma('journal_mode = WAL');
      handle = wrapBetter(db);
      log('info', `sqlite engine better-sqlite3 at ${dbPath}`);
    } catch (error) {
      handle = await wrapSqlJs(dbPath);
      log('warn', 'better-sqlite3 unavailable, using sql.js', { reason: error.message });
    }
  }

  const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  handle.exec(schema);
  for (const [column, type] of [['service', 'TEXT'], ['environment', 'TEXT'], ['timeframe', 'TEXT']]) {
    const cols = handle.all('PRAGMA table_info(incidents)');
    if (!cols.some((col) => col.name === column)) handle.run(`ALTER TABLE incidents ADD COLUMN ${column} ${type}`);
  }
  return handle;
}

export function db() {
  if (!handle) throw new Error('Database not initialized');
  return handle;
}

export function resetHandleForTests() {
  handle = null;
}
