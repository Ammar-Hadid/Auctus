import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { openDatabase, type Store } from '../src/server/db/connection';
import { createAuth } from '../src/server/auth';
import { provisionOwner } from '../src/server/owner';
import { createShowcase, digest } from '../src/server/showcase';
import { authorize } from '../src/server/api';
import { POST } from '../src/app/api/showcase/route';
const runtime = vi.hoisted(() => ({
  store: undefined as Store | undefined,
  auth: undefined as ReturnType<typeof createAuth> | undefined,
}));
vi.mock('../src/server/db/connection', async (original) => ({
  ...(await original<typeof import('../src/server/db/connection')>()),
  getStore: () => runtime.store!,
}));
vi.mock('../src/server/auth', async (original) => ({
  ...(await original<typeof import('../src/server/auth')>()),
  getAuth: () => runtime.auth!,
}));
const code = 'test-only-code',
  origin = 'https://auctus.example.test';
beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_URL', origin);
  vi.stubEnv('SHOWCASE_CODE_HASH', digest(code));
  runtime.store = openDatabase(':memory:');
  runtime.auth = createAuth(runtime.store, 'test-only-secret-at-least-32-characters', origin);
});
afterEach(() => {
  runtime.store!.sqlite.close();
  vi.unstubAllEnvs();
});
const post = (body: unknown, cookie = '') =>
  POST(
    new Request(origin + '/api/showcase', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    }),
  );

it('issues secure cookies, rejects extra identity fields, and revokes tokens on exit', async () => {
  expect((await post({ action: 'enter', code, userId: 'owner' })).status).toBe(400);
  const response = await post({ action: 'enter', code });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!;
  expect(cookie).toContain('__Host-auctus.showcase=');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie.toLowerCase()).toContain('samesite=lax');
  expect(cookie).toContain('Max-Age=7200');
  const request = new Request(origin + '/api/state', { headers: { cookie } });
  await expect(authorize(request)).rejects.toThrow('not available');
  const visitor = await authorize(request, false, false, 'training.read');
  expect(visitor.showcase).toBe(true);
  const bad = await post({ action: 'enter', code: 'wrong' }, cookie);
  expect(bad.status).toBe(401);
  expect((await authorize(request, false, false, 'training.read')).user.id).toBe(visitor.user.id);
  expect((await post({ action: 'leave' }, cookie)).headers.get('set-cookie')).toContain(
    'Max-Age=0',
  );
  await expect(authorize(request, false, false, 'training.read')).rejects.toThrow('expired');
});

it('a demo cookie cannot bypass a real master session awaiting passkey verification', async () => {
  const store = runtime.store!,
    auth = runtime.auth!;
  await provisionOwner(store, 'owner@example.test', 'test-only-owner-password');
  const demo = createShowcase(store, code);
  const login = await auth.handler(
    new Request(origin + '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.test', password: 'test-only-owner-password' }),
    }),
  );
  expect(login.status).toBe(200);
  const cookie = `${login.headers.get('set-cookie')}; __Host-auctus.showcase=${demo.token}`;
  await expect(
    authorize(
      new Request(origin + '/api/state', { headers: { cookie } }),
      false,
      false,
      'training.read',
    ),
  ).rejects.toThrow('Verify your passkey');
  expect((await post({ action: 'enter', code }, cookie)).status).toBe(409);
});
