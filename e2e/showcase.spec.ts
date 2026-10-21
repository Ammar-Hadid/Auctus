import { test, expect } from '@playwright/test';
const origin = 'http://localhost:3100';
const code = 'test-only-showcase-code';

test('public product page, code login, isolated training, restricted features and exit', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Put in the work. See your progress.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Showcase code', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Enter showcase' }).click();
  await expect(page.locator('#login-error')).toContainText('not valid');
  await page.getByLabel('Showcase code', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Enter showcase' }).click();
  await expect(page.getByRole('heading', { name: 'Make today count.' })).toBeVisible();
  await expect(page.getByText('Showcase mode', { exact: true })).toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  expect(state.account.role).toBe('showcase');
  expect(state.history.length).toBeGreaterThanOrEqual(9);
  for (const path of ['/api/accounts', '/api/passkeys', '/api/push']) {
    expect((await page.request.get(path)).status()).toBe(403);
    expect((await page.request.post(path, { headers: { origin }, data: {} })).status()).toBe(403);
  }
  expect(
    (
      await page.request.post('/api/showcase', {
        headers: { origin: 'https://foreign.example' },
        data: { action: 'enter', code },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post('/api/auth/sign-up/email', { headers: { origin }, data: {} })
    ).status(),
  ).toBe(404);
  const headers = { origin, 'x-auctus-account': state.account.id };
  expect(
    (
      await page.request.post('/api/command', {
        headers,
        data: { requestId: crypto.randomUUID(), action: 'ai.generate', data: {} },
      })
    ).status(),
  ).toBe(403);
  const other = await browser.newContext();
  try {
    expect(
      (
        await other.request.post(origin + '/api/showcase', {
          headers: { origin },
          data: { action: 'enter', code },
        })
      ).status(),
    ).toBe(200);
    const second = await (await other.request.get(origin + '/api/state')).json();
    expect(second.account.id).not.toBe(state.account.id);
    expect(
      (
        await page.request.post('/api/command', {
          headers,
          data: {
            requestId: crypto.randomUUID(),
            action: 'exercise.save',
            data: { ...second.exercises[0], name: 'Intrusion' },
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post('/api/command', {
          headers,
          data: {
            requestId: crypto.randomUUID(),
            action: 'workout.start',
            data: { assignment_id: state.assignments[0].id },
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await page.getByRole('button', { name: 'Start set 1', exact: true }).click();
    await page.getByLabel('Set 1 actual kg').fill('22');
    await page.getByLabel('Set 1 actual reps').fill('10');
    await page.getByRole('button', { name: 'Complete set', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible();
    expect(
      (await (await other.request.get(origin + '/api/state')).json()).activeWorkout,
    ).toBeNull();
    await page
      .getByRole('navigation', {
        name: page.viewportSize()!.width < 760 ? 'Mobile navigation' : 'Main navigation',
        exact: true,
      })
      .getByRole('button', { name: 'Overview', exact: true })
      .click();
    await page.getByRole('button', { name: 'Account settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Manage accounts' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Temporary demo' })).toBeVisible();
    await page.getByRole('button', { name: 'Exit demo', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Put in the work. See your progress.' }),
    ).toBeVisible();
    expect((await page.request.get('/api/state')).status()).toBe(401);
    expect((await other.request.get(origin + '/api/state')).status()).toBe(200);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'Sign in to your account', exact: true }).click();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  } finally {
    await other.close();
  }
  expect(errors).toEqual([]);
});
