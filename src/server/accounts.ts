import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { z } from 'zod';
import type { Store } from './db/connection';
import { requireCondition } from './errors';
export type AccountProfile = { id: string; name: string; email: string; role: 'master' | 'member' };
export function profile(store: Store, userId: string): AccountProfile {
  const user = store.sqlite
    .prepare(
      'SELECT u.id,u.name,u.email,a.role FROM user u JOIN account_access a ON a.user_id=u.id WHERE u.id=? AND a.disabled_at IS NULL',
    )
    .get(userId) as AccountProfile | undefined;
  requireCondition(user, 'Account is unavailable.', 401);
  return user;
}
export function requireMaster(store: Store, userId: string) {
  requireCondition(
    profile(store, userId).role === 'master',
    'Only the master account can manage accounts.',
    403,
  );
}
export async function confirmPassword(store: Store, userId: string, password: string) {
  // Persistent throttling also covers password confirmation for account creation.
  const key = 'account-confirm:' + userId,
    now = Date.now();
  store.sqlite
    .transaction(() => {
      const row = store.sqlite
        .prepare('SELECT count,last_request FROM rate_limit WHERE key=?')
        .get(key) as { count: number; last_request: number } | undefined;
      const count = row && now - row.last_request < 300000 ? row.count : 0;
      requireCondition(count < 5, 'Too many attempts. Wait five minutes before trying again.', 429);
      store.sqlite
        .prepare(
          'INSERT INTO rate_limit (id,key,count,last_request) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,last_request=excluded.last_request',
        )
        .run(key, key, count + 1, count === 0 ? now : row!.last_request);
    })
    .immediate();
  const account = store.sqlite
    .prepare("SELECT password FROM account WHERE user_id=? AND provider_id='credential'")
    .get(userId) as { password: string } | undefined;
  requireCondition(
    account && (await verifyPassword({ hash: account.password, password })),
    'Your current password is incorrect.',
    403,
  );
}
export async function createMember(store: Store, actorId: string, input: unknown) {
  requireMaster(store, actorId);
  const v = z
    .object({
      name: z.string().trim().min(1).max(80),
      email: z.email().trim().toLowerCase(),
      password: z.string().min(16).max(128),
    })
    .strict()
    .parse(input);
  const hash = await hashPassword(v.password);
  return store.sqlite
    .transaction(() => {
      requireMaster(store, actorId);
      requireCondition(
        !store.sqlite.prepare('SELECT id FROM user WHERE email=? COLLATE NOCASE').get(v.email),
        'An account with that email already exists.',
        409,
      );
      const id = randomUUID(),
        now = Date.now();
      store.sqlite
        .prepare(
          'INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)',
        )
        .run(id, v.name, v.email, now, now);
      store.sqlite
        .prepare(
          'INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
        )
        .run(randomUUID(), id, 'credential', id, hash, now, now);
      store.sqlite.prepare("INSERT INTO account_access VALUES (?,'member',NULL)").run(id);
      store.sqlite
        .prepare('INSERT INTO account_audit VALUES (?,?,?,?,?)')
        .run(randomUUID(), actorId, id, 'account.created', now);
      return profile(store, id);
    })
    .immediate();
}
