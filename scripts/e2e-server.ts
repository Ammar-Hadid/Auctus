import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/server/db/connection';
import { createMember } from '../src/server/accounts';
import { provisionOwner } from '../src/server/owner';
const dir = mkdtempSync(join(tmpdir(), 'auctus-e2e-'));
const file = join(dir, 'training.db');
const store = openDatabase(file);
await provisionOwner(store, 'master@example.test', 'test-only-master-password');
const master = store.sqlite
  .prepare("SELECT user_id AS id FROM account_access WHERE role='master'")
  .get() as { id: string };
await createMember(store, master.id, {
  name: 'Athlete',
  email: 'athlete@example.test',
  password: 'test-only-training-password',
});
store.sqlite.close();
const child = spawn(
  'node',
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_PATH: file,
      BETTER_AUTH_URL: 'http://localhost:3100',
      BETTER_AUTH_SECRET: 'e2e-only-secret-never-use-in-production-123456789',
    },
  },
);
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
