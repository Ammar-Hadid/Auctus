// Deliberate SSH/terminal recovery only. There is no public passkey reset endpoint.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { getStore } from '../src/server/db/connection';
import { resolve } from 'node:path';
import { mkdirSync, chmodSync } from 'node:fs';
if (!stdin.isTTY) throw new Error('Run interactively in a trusted terminal.');
const prompt = createInterface({ input: stdin, output: stdout });
const answer = await prompt.question(
  'Type RESET MASTER PASSKEYS to revoke master sessions and require new enrollment: ',
);
prompt.close();
if (answer !== 'RESET MASTER PASSKEYS') throw new Error('Cancelled.');
const store = getStore();
try {
  const master = store.sqlite
    .prepare("SELECT user_id FROM account_access WHERE role='master'")
    .get() as { user_id: string } | undefined;
  if (!master) throw new Error('Master account not found.');
  const dir = resolve(process.env.DATABASE_PATH || './data/auctus.db', '..', 'backups');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const backup = resolve(dir, `before-passkey-reset-${Date.now()}.db`);
  await store.sqlite.backup(backup);
  chmodSync(backup, 0o600);
  store.sqlite
    .transaction(() => {
      store.sqlite.prepare('DELETE FROM session WHERE user_id=?').run(master.user_id);
      store.sqlite.prepare('DELETE FROM passkey WHERE user_id=?').run(master.user_id);
    })
    .immediate();
  console.log(
    'Master sessions revoked. Sign in with your password and enroll a new passkey. Backup saved:',
    backup,
  );
} finally {
  store.sqlite.close();
}
