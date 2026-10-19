import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const testEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  AUCTUS_E2E_PRODUCTION: '1',
  NODE_ENV: 'production',
  BETTER_AUTH_URL: 'http://localhost:3100',
  BETTER_AUTH_SECRET: 'e2e-only-secret-never-use-in-production-123456789',
};
function execute(args: string[], env: NodeJS.ProcessEnv = testEnvironment) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`E2E command failed (${result.signal ?? result.status}): ${args.join(' ')}`);
}

// Build once, then reuse the same production assets for every isolated server.
// Explicit build-time settings prevent local .env files from selecting a real database.
const buildDirectory = mkdtempSync(join(tmpdir(), 'auctus-e2e-build-'));
try {
  execute(['node_modules/next/dist/bin/next', 'build'], {
    ...testEnvironment,
    DATABASE_PATH: join(buildDirectory, 'build.db'),
  });
} finally {
  rmSync(buildDirectory, { recursive: true, force: true });
}

// Each invocation gets a fresh disposable database. Small batches exercise the
// real sign-in limiter without exhausting one IP's allowance across unrelated tests.
const files = readdirSync('e2e')
  .filter((file) => file.endsWith('.spec.ts') && file !== 'accounts.spec.ts')
  .sort()
  .map((file) => `e2e/${file}`);
function run(project: string, files: string[], output: string) {
  execute([
    'node_modules/@playwright/test/cli.js',
    'test',
    ...files,
    `--project=${project}`,
    `--output=test-results/${output}`,
  ]);
}
run('chromium', ['e2e/accounts.spec.ts'], 'accounts');
for (const project of ['chromium', 'webkit-mobile']) {
  for (let i = 0; i < files.length; i += 3) {
    run(project, files.slice(i, i + 3), `${project}-${i / 3 + 1}`);
  }
}
