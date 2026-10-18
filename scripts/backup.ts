import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
const source = resolve(process.env.DATABASE_PATH || './data/auctus.db');
const target = resolve(
  process.argv[2] || `./data/backups/auctus-${new Date().toISOString().replaceAll(':', '-')}.db`,
);
if (source === target) throw new Error('Backup destination must differ from the live database.');
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  await db.backup(target);
  chmodSync(target, 0o600);
  const copy = new Database(target, { readonly: true });
  try {
    if (copy.pragma('integrity_check', { simple: true }) !== 'ok')
      throw new Error('Backup integrity verification failed.');
    if ((copy.pragma('foreign_key_check') as unknown[]).length)
      throw new Error('Backup foreign-key verification failed.');
  } finally {
    copy.close();
  }
  console.log(`Verified backup saved: ${target}`);
} finally {
  db.close();
}
