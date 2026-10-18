import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env.local')) {
  console.log('.env.local already exists; left unchanged.');
} else {
  writeFileSync(
    '.env.local',
    `DATABASE_PATH=./data/auctus.db\nBETTER_AUTH_URL=http://127.0.0.1:3105\nBETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\n`,
    { mode: 0o600 },
  );
  console.log('Created private .env.local with a random authentication secret.');
}
console.log('Next: pnpm db:migrate, then pnpm owner to create your private account.');
