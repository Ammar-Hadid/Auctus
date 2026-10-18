import { describe, it, expect, vi } from 'vitest';
import { openDatabase } from '../src/server/db/connection';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
import {
  deliverDueRests,
  saveSubscription,
  pushKeys,
  subscriptionSchema,
} from '../src/server/push';
function setup() {
  const store = openDatabase(':memory:');
  let now = Date.parse('2026-10-18T12:00Z');
  store.sqlite
    .prepare(
      "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('u','Owner','push@example.test',1,?,?)",
    )
    .run(now, now);
  store.sqlite
    .prepare(
      "INSERT INTO session (id,expires_at,token,created_at,updated_at,user_id) VALUES ('s',?,'test-token',?,?,'u')",
    )
    .run(now + 86400000, now, now);
  const keys = pushKeys(store);
  const subscription = {
    endpoint: 'https://web.push.apple.com/test',
    keys: { p256dh: keys.public_key, auth: Buffer.alloc(16, 1).toString('base64url') },
  };
  const id = saveSubscription(store, 's', subscription, now);
  const programming = new Programming(store, () => now);
  const exercise = programming.saveExercise({ name: 'Row' });
  const program = programming.saveProgram({ name: 'Strength' });
  programming.saveTemplate({
    program_id: program.id,
    name: 'A',
    exercises: [
      {
        exercise_id: exercise.id,
        sets: [{ type: 'normal', min_reps: 8, max_reps: 8, rest_ms: 1000 }],
      },
    ],
  });
  programming.selectProgram(program.id);
  const sessions = new Sessions(store, () => now);
  let workout = sessions.start(programming.availability().assignments[0].id, false);
  const act = (action: string, extra: Record<string, unknown> = {}) =>
    (workout = sessions.act({
      workout_id: workout.id,
      version: sessions.get(workout.id).version,
      action,
      ...extra,
    }));
  act('exercise.start', { id: workout.exercises[0].id });
  act('set.start', { id: workout.exercises[0].sets[0].id });
  act('set.complete', { id: workout.exercises[0].sets[0].id, actual_reps: 8, actual_grams: 10000 });
  return {
    store,
    id,
    subscription,
    act,
    restId: workout.rests[0].id,
    tick: (ms: number) => (now += ms),
    now: () => now,
  };
}
describe('background rest notifications', () => {
  it('keeps keys stable and rejects arbitrary network destinations', () => {
    const x = setup();
    expect(pushKeys(x.store)).toEqual(pushKeys(x.store));
    for (const endpoint of [
      'http://web.push.apple.com/test',
      'https://127.0.0.1/x',
      'https://web.push.apple.com.evil.test/x',
      'https://user@web.push.apple.com/x',
    ])
      expect(() => subscriptionSchema.parse({ ...x.subscription, endpoint })).toThrow();
    x.store.sqlite.close();
  });
  it('sends once per due deadline and respects pauses, extensions, and completed workouts', async () => {
    const x = setup();
    const send = vi.fn().mockResolvedValue({});
    await deliverDueRests(x.store, send, x.now());
    expect(send).not.toHaveBeenCalled();
    x.tick(1000);
    await Promise.all([
      deliverDueRests(x.store, send, x.now()),
      deliverDueRests(x.store, send, x.now()),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    x.act('workout.pause');
    x.tick(1000);
    x.act('workout.resume');
    await deliverDueRests(x.store, send, x.now());
    expect(send).toHaveBeenCalledTimes(1);
    x.act('rest.extend', { id: x.restId, ms: 5000 });
    x.act('rest.pause', { id: x.restId });
    x.tick(6000);
    await deliverDueRests(x.store, send, x.now());
    expect(send).toHaveBeenCalledTimes(1);
    x.act('rest.resume', { id: x.restId });
    x.act('workout.pause');
    x.tick(6000);
    await deliverDueRests(x.store, send, x.now());
    expect(send).toHaveBeenCalledTimes(1);
    x.act('workout.resume');
    x.tick(5000);
    await deliverDueRests(x.store, send, x.now());
    expect(send).toHaveBeenCalledTimes(2);
    x.act('workout.complete', { skipRemaining: true });
    await deliverDueRests(x.store, send, x.now());
    expect(send).toHaveBeenCalledTimes(2);
    x.store.sqlite.close();
  });
  it('drops old alarms and session revocation removes subscriptions', async () => {
    const x = setup();
    const send = vi.fn();
    x.tick(32000);
    await deliverDueRests(x.store, send, x.now());
    expect(send).not.toHaveBeenCalled();
    x.store.sqlite.prepare("DELETE FROM session WHERE id='s'").run();
    expect(x.store.sqlite.prepare('SELECT * FROM push_subscription').all()).toEqual([]);
    x.store.sqlite.close();
  });
  it('retries transient failures but removes expired push endpoints', async () => {
    const x = setup();
    const send = vi
      .fn()
      .mockRejectedValueOnce({ statusCode: 503 })
      .mockRejectedValueOnce({ statusCode: 410 });
    x.tick(1000);
    await deliverDueRests(x.store, send, x.now());
    await deliverDueRests(x.store, send, x.now());
    expect(send).toHaveBeenCalledTimes(1);
    x.tick(15000);
    await deliverDueRests(x.store, send, x.now());
    expect(send).toHaveBeenCalledTimes(2);
    expect(x.store.sqlite.prepare('SELECT * FROM push_subscription').all()).toEqual([]);
    x.store.sqlite.close();
  });
  it('does not send after logout or while the rest has ended', async () => {
    const x = setup();
    const send = vi.fn();
    x.act('rest.end');
    x.tick(1000);
    await deliverDueRests(x.store, send, x.now());
    expect(send).not.toHaveBeenCalled();
    x.store.sqlite.close();
  });
});
