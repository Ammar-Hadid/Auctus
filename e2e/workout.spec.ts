import { test, expect } from '@playwright/test';
test('author, train, recover, correct history and inspect progress', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Back to/ })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('athlete@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-only-training-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make today count.' })).toBeVisible();
  const nav = page.getByRole('navigation', {
    name: page.viewportSize()!.width < 760 ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
  await nav.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'New exercise', exact: true }).click();
  const suffix = Date.now().toString();
  await page.getByLabel('Name', { exact: true }).fill('Row ' + suffix);
  await page.getByRole('button', { name: 'Save exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Row ' + suffix })).toBeVisible();
  await nav.getByRole('button', { name: 'Programs' }).click();
  await page.getByRole('button', { name: 'New program', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Strength ' + suffix);
  await page.getByRole('button', { name: 'Save program' }).click();
  await page
    .getByRole('heading', { name: 'Strength ' + suffix, exact: true })
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Open program' })
    .click();
  await page.getByRole('button', { name: 'New workout' }).click();
  await page.getByLabel('Workout name').fill('Full Body ' + suffix);
  await page.getByRole('combobox', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('option', { name: 'Row ' + suffix, exact: true }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await expect(page.getByLabel('Set 1 target kg')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await page.getByRole('button', { name: 'Use this program' }).click();
  await nav.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByRole('heading', { name: 'Full Body ' + suffix })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Full Body ' + suffix })).toBeVisible();
  // Command responses carry authoritative state even if a subsequent state read fails.
  await page.route('**/api/state', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page
    .getByRole('button', { name: 'Start workout', exact: true })
    .and(page.locator(':enabled'))
    .click();
  await expect(page.getByRole('button', { name: 'Start exercise', exact: true })).toBeVisible();
  await page.unroute('**/api/state');
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Start set 1', exact: true }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('');
  await page.getByLabel('Set 1 actual kg').fill('22');
  await page.getByLabel('Set 1 actual reps').fill('9');
  await page.reload();
  await page.getByRole('button', { name: 'Continue workout' }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('22');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible();
  await page.screenshot({
    path: `test-results/active-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('Rest paused', { exact: false })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue workout' }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'End rest', exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm finish' }).click();
  await expect(
    page.getByRole('button', { name: 'Repeat', exact: true }).and(page.locator(':enabled')),
  ).toBeVisible();
  await nav.getByRole('button', { name: 'History', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Full Body ' + suffix, exact: true })
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'View workout' })
    .click();
  await page.getByRole('button', { name: 'Edit set 1', exact: true }).click();
  await page.getByLabel('Corrected weight').fill('24');
  await page.getByRole('combobox', { name: 'Set type', exact: true }).click();
  await page.getByRole('option', { name: 'Dropset', exact: true }).click();
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText('24 kg × 9', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('24', { exact: true })).toBeVisible();
  await expect(page.getByText('31.2', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Metric', exact: true }).click();
  await page.getByRole('option', { name: 'Estimated 1RM', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Metric', exact: true })).toContainText(
    'Estimated 1RM',
  );
  await page.screenshot({
    path: `test-results/progress-${test.info().project.name}.png`,
    fullPage: true,
  });
  await nav.getByRole('button', { name: 'Overview' }).click();
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize(test.info().project.use.viewport!);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  // An offline start remains explicitly unconfirmed, then safely retries once online.
  await page.context().setOffline(true);
  await page
    .getByRole('button', { name: 'Repeat', exact: true })
    .and(page.locator(':enabled'))
    .click();
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await page.getByRole('button', { name: 'Continue workout' }).click();
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Start set 1', exact: true }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('24');
  await page.reload();
  await page.getByRole('button', { name: 'Continue workout' }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('24');
  // Clearing a suggestion is an intentional draft; it stays empty after reload.
  await page.getByLabel('Set 1 actual kg').fill('');
  await page.reload();
  await page.getByRole('button', { name: 'Continue workout' }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('');
  await page.getByLabel('Set 1 actual kg').fill('40');
  await page.getByLabel('Set 1 actual reps').fill('8');
  // Simulate a committed write whose response never reaches the phone.
  await page.route(
    '**/api/command',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  expect(
    state.activeWorkout.exercises
      .flatMap((e: { sets: unknown[] }) => e.sets)
      .filter((s: { status: string }) => s.status === 'completed'),
  ).toHaveLength(1);
  expect(state.activeWorkout.rests).toHaveLength(1);
  expect(state.activeWorkout.exercises[0].sets[0].actual_grams).toBe(40000);
  // The next set picks up the weight just performed in this workout.
  await page.getByRole('button', { name: 'Start set 2', exact: true }).click();
  await expect(page.getByLabel('Set 2 actual kg')).toHaveValue('40');
  const nextState = await (await page.request.get('/api/state')).json();
  expect(nextState.activeWorkout.exercises[0].sets[1].actual_grams).toBeNull();
  const w = nextState.activeWorkout;
  const requests = await Promise.all(
    [1, 2].map(() =>
      page.request.post('/api/command', {
        headers: { origin: 'http://127.0.0.1:3100' },
        data: {
          requestId: crypto.randomUUID(),
          action: 'session.action',
          data: { workout_id: w.id, version: w.version, action: 'workout.pause' },
        },
      }),
    ),
  );
  expect(requests.map((r) => r.status()).sort()).toEqual([200, 409]);
  await page.reload();
  await page.getByRole('button', { name: 'Continue workout' }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abandon workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm abandon', exact: true }).click();
  await page.getByRole('button', { name: 'Account settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Back to/ })).toBeVisible();
  expect((await page.request.get('/api/state')).status()).toBe(401);
});

test('rejects unauthenticated reads, cross-origin writes and public signup', async ({
  request,
}) => {
  expect((await request.get('/api/state')).status()).toBe(401);
  expect(
    (
      await request.post('/api/command', {
        headers: { origin: 'https://attacker.example' },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await request.post('/api/auth/sign-up/email', { data: {} })).status()).toBe(404);
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).display).toBe('standalone');
  expect((await request.get('/icon-192.png')).ok()).toBe(true);
});
