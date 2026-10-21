import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase, forUser, type Store } from '../src/server/db/connection';
import {
  cleanupShowcases,
  createShowcase,
  deleteShowcase,
  digest,
  showcaseSession,
  SHOWCASE_DURATION,
} from '../src/server/showcase';
import { requireShowcaseCapability } from '../src/server/showcase-policy';
import { profile, requireMaster, createMember } from '../src/server/accounts';
import { readState } from '../src/server/read-state';
import { dispatch } from '../src/server/dispatch';
import { provisionOwner } from '../src/server/owner';
import { passkeyOptions, passkeyVerified } from '../src/server/passkeys';
let store: Store;
const code = 'test-only-showcase-code-938461';
const hash = digest(code);
const cookie = (token: string) => new Headers({ cookie: `auctus.showcase=${token}` });
beforeEach(() => {
  store = openDatabase(':memory:');
  vi.stubEnv('SHOWCASE_CODE_HASH', hash);
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3105');
});
afterEach(() => {
  store.sqlite.close();
  vi.unstubAllEnvs();
});

it('creates independent fictional journals with no credentials or permanent account access', () => {
  const a = createShowcase(store, code),
    b = createShowcase(store, code);
  const first = readState(forUser(store, a.userId)),
    second = readState(forUser(store, b.userId));
  expect(first.history.length).toBeGreaterThanOrEqual(9);
  expect(first.assignments).toHaveLength(3);
  expect(first.account.role).toBe('showcase');
  expect(first.exercises[0].id).not.toBe(second.exercises[0].id);
  for (const table of ['account', 'account_access', 'session'])
    expect(store.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
  expect(showcaseSession(store, cookie(a.token))?.user.id).toBe(a.userId);
  expect(
    store.sqlite.prepare('SELECT token_hash FROM showcase_visitor WHERE user_id=?').get(a.userId),
  ).toEqual({ token_hash: digest(a.token) });
  const run = (action: string, data: Record<string, unknown>) =>
    dispatch(forUser(store, a.userId), { requestId: randomUUID(), action, data });
  expect(() => run('exercise.save', { ...second.exercises[0], name: 'Intrusion' })).toThrow(
    'not found',
  );
  expect(() => run('workout.start', { assignment_id: second.assignments[0].id })).toThrow();
  const workout = run('workout.start', { assignment_id: first.assignments[0].id });
  expect(workout).toHaveProperty('status', 'active');
  expect(readState(forUser(store, b.userId)).activeWorkout).toBeNull();
});

it('rejects account management, passkeys, and new routes or command actions by default', async () => {
  const visitor = createShowcase(store, code);
  expect(() => requireMaster(store, visitor.userId)).toThrow('Only the master');
  await expect(
    createMember(store, visitor.userId, {
      name: 'Bad',
      email: 'bad@example.test',
      password: 'not-a-real-password',
    }),
  ).rejects.toThrow('Only the master');
  await expect(passkeyOptions(store, visitor.userId, visitor.userId, 'register')).rejects.toThrow(
    'Only the master',
  );
  expect(() => requireShowcaseCapability(true)).toThrow('not available');
  expect(() => requireShowcaseCapability(true, 'training.read')).not.toThrow();
  for (const [action, data] of [
    ['ai.generate', {}],
    ['accounts.create', {}],
    ['session.action', { action: 'ai.coach' }],
  ] as const) {
    expect(() =>
      dispatch(forUser(store, visitor.userId), { requestId: randomUUID(), action, data }),
    ).toThrow('not available');
  }
});

it('expires without renewal, revokes on rotation, cleans complete journals, and preserves real accounts', async () => {
  await provisionOwner(store, 'owner@example.test', 'a-test-only-master-password');
  const owner = store.sqlite
    .prepare("SELECT user_id AS id FROM account_access WHERE role='master'")
    .get() as { id: string };
  const now = Date.now(),
    a = createShowcase(store, code, now),
    b = createShowcase(store, code, now + 1000);
  expect(passkeyVerified(store, 'fake-session', owner.id)).toBe(false);
  expect(showcaseSession(store, cookie(a.token), now + SHOWCASE_DURATION)).toBeNull();
  expect(showcaseSession(store, cookie(a.token), now, digest('rotated'))).toBeNull();
  expect(showcaseSession(store, cookie(a.token + 'bad'))).toBeNull();
  cleanupShowcases(store, now + SHOWCASE_DURATION);
  expect(store.sqlite.prepare('SELECT id FROM user WHERE id=?').get(a.userId)).toBeUndefined();
  expect(profile(store, b.userId).role).toBe('showcase');
  deleteShowcase(store, owner.id);
  expect(profile(store, owner.id).role).toBe('master');
  vi.stubEnv('SHOWCASE_CODE_HASH', digest('rotated'));
  cleanupShowcases(store, now);
  expect(store.sqlite.prepare('SELECT count(*) n FROM showcase_visitor').get()).toEqual({ n: 0 });
  expect(store.sqlite.prepare('SELECT count(*) n FROM exercise').get()).toEqual({ n: 0 });
  expect(store.sqlite.prepare('SELECT count(*) n FROM workout_session').get()).toEqual({ n: 0 });
  expect(store.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
});

it('fails closed without a code and persists the guessing limit even for bad codes', () => {
  expect(() => createShowcase(store, code, Date.now(), null)).toThrow('not available');
  const now = Date.now();
  for (let i = 0; i < 20; i++)
    expect(() => createShowcase(store, 'wrong', now)).toThrow('not valid');
  expect(() => createShowcase(store, code, now)).toThrow('Too many');
  expect(store.sqlite.prepare('SELECT count(*) AS n FROM user').get()).toEqual({ n: 0 });
  expect(() => createShowcase(store, code, now + 60001)).not.toThrow();
});

it('limits new demo writes while preserving retries of a previously confirmed action', () => {
  const visitor = createShowcase(store, code);
  const scoped = forUser(store, visitor.userId);
  const request = {
    requestId: randomUUID(),
    action: 'exercise.save',
    data: { name: 'A confirmed exercise' },
  };
  const result = dispatch(scoped, request);
  const insert = store.sqlite.prepare('INSERT INTO mutation_receipt VALUES (?,?,?,?,?)');
  for (let i = 0; i < 399; i++)
    insert.run(visitor.userId, randomUUID(), 'test-fixture', '{}', Date.now());
  expect(dispatch(scoped, request)).toEqual(result);
  expect(() => dispatch(scoped, { ...request, requestId: randomUUID() })).toThrow('activity limit');
});
