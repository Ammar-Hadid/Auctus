import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { forUser, type Store } from './db/connection';
import { requireCondition } from './errors';
import { seedShowcase } from './showcase-seed';

export const SHOWCASE_DURATION = 2 * 60 * 60 * 1000;
export const showcaseCookieName = () =>
  (process.env.BETTER_AUTH_URL?.startsWith('https://') ? '__Host-' : '') + 'auctus.showcase';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function showcaseCodeHash() {
  const hash = process.env.SHOWCASE_CODE_HASH;
  return hash && /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}
export function showcaseToken(headers: Headers) {
  const prefix = showcaseCookieName() + '=';
  const token = headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return token && /^[a-zA-Z0-9_-]{43}$/.test(token) ? token : null;
}
export function showcaseSession(
  store: Store,
  headers: Headers,
  now = Date.now(),
  codeHash = showcaseCodeHash(),
) {
  const token = showcaseToken(headers);
  if (!token || !codeHash) return null;
  const row = store.sqlite
    .prepare(
      'SELECT user_id,expires_at FROM showcase_visitor WHERE token_hash=? AND code_hash=? AND expires_at>?',
    )
    .get(digest(token), codeHash, now) as { user_id: string; expires_at: number } | undefined;
  return row
    ? {
        user: { id: row.user_id },
        session: { id: row.user_id, expiresAt: new Date(row.expires_at) },
        showcase: true as const,
      }
    : null;
}
export function deleteShowcase(store: Store, userId: string) {
  store.sqlite
    .transaction(() => {
      // A missing marker must never let this cleanup touch a permanent account.
      if (!store.sqlite.prepare('SELECT 1 FROM showcase_visitor WHERE user_id=?').get(userId))
        return;
      const workouts = 'SELECT id FROM workout_session WHERE user_id=?';
      store.sqlite
        .prepare(`UPDATE set_session SET prefill_set_id=NULL WHERE workout_id IN (${workouts})`)
        .run(userId);
      for (const table of ['rest_period', 'workout_pause', 'set_session', 'exercise_session'])
        store.sqlite.prepare(`DELETE FROM ${table} WHERE workout_id IN (${workouts})`).run(userId);
      for (const table of [
        'mutation_receipt',
        'settings',
        'workout_session',
        'weekly_assignment',
        'schedule_event',
        'workout_template',
        'program',
        'exercise',
      ])
        store.sqlite.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(userId);
      store.sqlite.prepare('DELETE FROM user WHERE id=?').run(userId);
    })
    .immediate();
}
export function cleanupShowcases(store: Store, now = Date.now()) {
  const rows = store.sqlite
    .prepare('SELECT user_id FROM showcase_visitor WHERE expires_at<=? OR code_hash<>? LIMIT 100')
    .all(now, showcaseCodeHash() ?? '') as { user_id: string }[];
  for (const row of rows) deleteShowcase(store, row.user_id);
}
export function createShowcase(
  store: Store,
  code: string,
  now = Date.now(),
  codeHash = showcaseCodeHash(),
) {
  requireCondition(codeHash, 'Showcase access is not available right now.', 503);
  // Global DB-backed budget: deliberately ignores spoofable forwarded IP headers.
  store.sqlite
    .transaction(() => {
      const key = 'showcase-login';
      const row = store.sqlite
        .prepare('SELECT count,last_request FROM rate_limit WHERE key=?')
        .get(key) as { count: number; last_request: number } | undefined;
      const count = row && now - row.last_request < 60000 ? row.count : 0;
      requireCondition(count < 20, 'Too many attempts. Please try again in a minute.', 429);
      store.sqlite
        .prepare(
          'INSERT INTO rate_limit (id,key,count,last_request) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,last_request=excluded.last_request',
        )
        .run(key, key, count + 1, count ? row!.last_request : now);
    })
    .immediate();
  requireCondition(
    timingSafeEqual(Buffer.from(digest(code)), Buffer.from(codeHash)),
    'That showcase code is not valid. Please try again.',
    401,
  );
  return store.sqlite
    .transaction(() => {
      const count = store.sqlite.prepare('SELECT count(*) AS n FROM showcase_visitor').get() as {
        n: number;
      };
      requireCondition(count.n < 100, 'The showcase is busy. Please try again later.', 429);
      const userId = randomUUID(),
        token = randomBytes(32).toString('base64url'),
        expiresAt = now + SHOWCASE_DURATION;
      store.sqlite
        .prepare(
          "INSERT INTO user (id,name,email,created_at,updated_at) VALUES (?,'Showcase visitor',?,?,?)",
        )
        .run(userId, `${userId}@showcase.invalid`, now, now);
      store.sqlite
        .prepare('INSERT INTO showcase_visitor VALUES (?,?,?,?)')
        .run(userId, digest(token), codeHash, expiresAt);
      seedShowcase(forUser(store, userId), now);
      return { userId, token, expiresAt };
    })
    .immediate();
}
