import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export function openDatabase(path = process.env.DATABASE_PATH || './data/auctus.db') {
  if (path !== ':memory:')
    mkdirSync(dirname(resolve(/* turbopackIgnore: true */ path)), { recursive: true, mode: 0o700 });
  const sqlite = new Database(path);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = FULL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at INTEGER NOT NULL)',
  );
  const migrate = sqlite.transaction(() => {
    for (const name of readdirSync(resolve('migrations'))
      .filter((n) => n.endsWith('.sql'))
      .sort()) {
      const sql = readFileSync(resolve('migrations', name), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const prior = sqlite.prepare('SELECT hash FROM _migrations WHERE name=?').get(name) as
        { hash: string } | undefined;
      if (prior && prior.hash !== hash) throw new Error(`Applied migration changed: ${name}`);
      if (!prior) {
        sqlite.exec(sql);
        sqlite.prepare('INSERT INTO _migrations VALUES (?,?,?)').run(name, hash, Date.now());
      }
    }
  });
  try {
    migrate.immediate();
  } catch (error) {
    sqlite.close();
    throw error;
  }
  return { sqlite, orm: drizzle(sqlite) };
}
export type Store = ReturnType<typeof openDatabase> & { userId?: string };
export function forUser(store: Store, userId: string): Store {
  if (!userId) throw new Error('Account scope is required.');
  return { ...store, userId };
}
export function accountId(store: Store): string {
  if (!store.userId) throw new Error('Account scope is required.');
  return store.userId;
}
const globalStore = globalThis as typeof globalThis & { auctusStore?: Store };
export function getStore() {
  return (globalStore.auctusStore ??= openDatabase());
}
