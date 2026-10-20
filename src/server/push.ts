import webpush from 'web-push';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { forUser, type Store } from './db/connection';
import { Sessions } from './sessions';
import { restRemaining } from '../domain/timing';
import { requireCondition } from './errors';

export function pushSubject() {
  const value = process.env.BETTER_AUTH_URL;
  if (!value) return null;
  const url = new URL(value);
  return url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)
    ? url.origin
    : null;
}
export function pushKeys(store: Store) {
  return store.sqlite
    .transaction(() => {
      let keys = store.sqlite
        .prepare('SELECT public_key,private_key FROM push_keys WHERE id=1')
        .get() as { public_key: string; private_key: string } | undefined;
      if (!keys) {
        const generated = webpush.generateVAPIDKeys();
        keys = { public_key: generated.publicKey, private_key: generated.privateKey };
        store.sqlite
          .prepare('INSERT INTO push_keys VALUES (1,?,?)')
          .run(keys.public_key, keys.private_key);
      }
      return keys;
    })
    .immediate();
}
export const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine((value) => {
      const url = new URL(value);
      // These are browser push services, never arbitrary server-side fetch targets.
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.port &&
        (url.hostname.endsWith('.push.apple.com') ||
          url.hostname === 'web.push.apple.com' ||
          url.hostname === 'fcm.googleapis.com' ||
          url.hostname === 'updates.push.services.mozilla.com' ||
          url.hostname.endsWith('.notify.windows.com'))
      );
    }, 'Unsupported push service.'),
  keys: z.object({
    p256dh: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .refine((v) => Buffer.from(v, 'base64url').length === 65),
    auth: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .refine((v) => Buffer.from(v, 'base64url').length === 16),
  }),
});
export const subscriptionId = (endpoint: string) =>
  createHash('sha256').update(endpoint).digest('hex');
export function saveSubscription(
  store: Store,
  sessionId: string,
  input: unknown,
  now = Date.now(),
) {
  const subscription = subscriptionSchema.parse(input);
  const id = subscriptionId(subscription.endpoint);
  const count = store.sqlite.prepare('SELECT count(*) AS count FROM push_subscription').get() as {
    count: number;
  };
  requireCondition(
    count.count < 20 || store.sqlite.prepare('SELECT id FROM push_subscription WHERE id=?').get(id),
    'Too many notification devices. Disable an old device first.',
  );
  store.sqlite
    .prepare(
      'INSERT INTO push_subscription VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id,subscription=excluded.subscription',
    )
    .run(id, sessionId, JSON.stringify(subscription), now);
  return id;
}
export type PushPayload = { title: string; body: string; tag: string; url: string };
export type PushSender = (
  subscription: webpush.PushSubscription,
  payload: PushPayload,
) => Promise<unknown>;
export function sender(store: Store, subject: string): PushSender {
  const keys = pushKeys(store);
  return (subscription, payload) =>
    webpush.sendNotification(subscription, JSON.stringify(payload), {
      vapidDetails: { subject, publicKey: keys.public_key, privateKey: keys.private_key },
      TTL: 30,
      urgency: 'high',
      timeout: 10000,
    });
}
export async function deliverDueRests(store: Store, send: PushSender, now = Date.now()) {
  const rows = store.sqlite
    .prepare("SELECT id,user_id FROM workout_session WHERE status='active'")
    .all() as { id: string; user_id: string }[];
  for (const row of rows) await deliverWorkoutRest(forUser(store, row.user_id), send, now, row.id);
}
async function deliverWorkoutRest(store: Store, send: PushSender, now: number, workoutId: string) {
  const workout = new Sessions(store).get(workoutId);
  const rest = workout.rests.find((r) => r.ended_at === null && r.timer_paused_at === null);
  if (!rest) return;
  const remaining = restRemaining(rest, workout.pauses, now);
  // Drop stale alarms after server/network downtime; push is not an exact alarm clock.
  if (remaining > 0 || remaining < -30000) return;
  const deadline = Math.round(now + remaining);
  const subscriptions = store.sqlite
    .prepare(
      "SELECT p.id,p.subscription FROM push_subscription p JOIN session s ON s.id=p.session_id JOIN account_access a ON a.user_id=s.user_id WHERE s.user_id=? AND a.disabled_at IS NULL AND (a.role='member' OR EXISTS(SELECT 1 FROM session_verification v WHERE v.session_id=s.id)) AND s.expires_at>? AND p.created_at<=?",
    )
    .all(store.userId, now, deadline) as { id: string; subscription: string }[];
  for (const subscription of subscriptions) {
    // Recheck after each awaited network request: pause, extension, or ending rest cancels unsent work.
    if (
      !store.sqlite
        .prepare('SELECT id FROM workout_session WHERE id=? AND user_id=?')
        .get(workout.id, store.userId)
    )
      break;
    const current = new Sessions(store).get(workout.id);
    const active = current.rests.find(
      (r) => r.id === rest.id && r.ended_at === null && r.timer_paused_at === null,
    );
    if (
      current.status !== 'active' ||
      !active ||
      Math.round(now + restRemaining(active, current.pauses, now)) !== deadline
    )
      break;
    const claimed = store.sqlite
      .transaction(() => {
        store.sqlite
          .prepare(
            'INSERT OR IGNORE INTO push_delivery (subscription_id,rest_id,extension_ms) VALUES (?,?,?)',
          )
          .run(subscription.id, rest.id, rest.added_ms);
        return store.sqlite
          .prepare(
            'UPDATE push_delivery SET attempts=attempts+1,retry_at=? WHERE subscription_id=? AND rest_id=? AND extension_ms=? AND sent_at IS NULL AND attempts<3 AND retry_at<=?',
          )
          .run(now + 15000, subscription.id, rest.id, rest.added_ms, now).changes;
      })
      .immediate();
    if (!claimed) continue;
    try {
      await send(JSON.parse(subscription.subscription), {
        title: 'Rest complete',
        body: 'Your next set is ready in Auctus.',
        tag: `rest-${rest.id}`,
        url: '/',
      });
      store.sqlite
        .prepare(
          'UPDATE push_delivery SET sent_at=? WHERE subscription_id=? AND rest_id=? AND extension_ms=?',
        )
        .run(now, subscription.id, rest.id, rest.added_ms);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410)
        store.sqlite.prepare('DELETE FROM push_subscription WHERE id=?').run(subscription.id);
      // Do not log endpoints, keys, or provider response bodies.
      else console.warn('Rest push delivery failed; bounded retry scheduled.', status ?? 'network');
    }
  }
}
