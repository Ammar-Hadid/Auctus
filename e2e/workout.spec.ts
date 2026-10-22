import { test, expect } from '@playwright/test';
import { verifyPerSetWeightHistory } from './weight-prefill';
test('author, train, recover, correct history and inspect progress', async ({ page }) => {
  await page.addInitScript(() => {
    const tracked = window as typeof window & { tonesStarted: number };
    tracked.tonesStarted = 0;
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source);
      source.start = (when?: number) => {
        tracked.tonesStarted++;
        start(when);
      };
      return source;
    };
  });
  await page.goto('/login/account');
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
  await page.getByRole('combobox', { name: 'Equipment', exact: true }).click();
  await page.getByRole('option', { name: 'Stack machine', exact: true }).click();
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
  await page.getByLabel('Set 1 minimum reps').fill('9');
  await page.getByLabel('Set 1 maximum reps').fill('8');
  await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New workout', exact: true })).toBeVisible();
  expect(
    await page
      .getByLabel('Set 1 maximum reps')
      .evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow),
  ).toBe(true);
  await page.getByLabel('Set 1 minimum reps').fill('6');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByLabel('Set 1 maximum reps')).toBeVisible();
  }
  await page.setViewportSize(test.info().project.use.viewport!);
  await page.screenshot({
    path: `test-results/rep-range-template-${test.info().project.name}.png`,
    fullPage: true,
  });
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
  await expect(page.getByRole('button', { name: 'Start set 1', exact: true })).toBeVisible();
  await page.unroute('**/api/state');
  await expect(page.getByText('Aim for 6–8 reps', { exact: false })).toBeVisible();
  await page.getByText('Set options', { exact: true }).click();
  await page
    .locator('.set-card')
    .filter({
      has: page.getByRole('button', { name: 'Start set 1', exact: true }),
    })
    .getByRole('button', { name: 'Edit set plan', exact: true })
    .click();
  await page.getByLabel('Set 1 minimum reps').fill('9');
  await page.getByRole('button', { name: 'Save set changes', exact: true }).click();
  await expect(
    page.getByText('Maximum reps must be at least minimum reps.', { exact: false }),
  ).toBeVisible();
  await page.getByLabel('Set 1 minimum reps').fill('6');
  await page.getByRole('button', { name: 'Save set changes', exact: true }).click();
  await page.getByRole('button', { name: 'Start set 1', exact: true }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('');
  await page.getByLabel('Set 1 actual kg').fill('22');
  await page.getByLabel('Set 1 actual reps').fill('9');
  await page.reload();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('22');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible();
  const restTimer = page.getByRole('region', { name: 'Rest timer' });
  await restTimer.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { tonesStarted: number }).tonesStarted),
    )
    .toBe(0);
  await expect(restTimer.getByRole('button', { name: 'Sound on', exact: true })).toBeVisible();
  await expect(restTimer.getByRole('button', { name: 'Stop alarm', exact: true })).toHaveCount(0);

  await restTimer.getByRole('button', { name: 'Pause rest timer', exact: true }).click();
  await expect(restTimer.getByText('Rest paused', { exact: true })).toBeVisible();
  const pausedTime = await restTimer.getByRole('timer').textContent();
  await expect(page.getByRole('button', { name: 'Start set 2', exact: true })).toBeVisible();
  expect((await (await page.request.get('/api/state')).json()).activeWorkout.status).toBe('active');
  await restTimer.getByRole('button', { name: '+5s', exact: true }).click();
  await restTimer.getByRole('button', { name: '+15s', exact: true }).click();
  const seconds = (text: string | null) =>
    text!
      .split(':')
      .map(Number)
      .reduce((a, b) => a * 60 + b);
  await expect
    .poll(
      async () => seconds(await restTimer.getByRole('timer').textContent()) - seconds(pausedTime),
    )
    .toBe(20);
  const extendedTime = await restTimer.getByRole('timer').textContent();
  await page.reload();
  await expect(restTimer.getByRole('timer')).toHaveText(extendedTime!);
  await expect(
    restTimer.getByRole('button', { name: 'Resume rest timer', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const timerBox = await restTimer.boundingBox();
  expect(timerBox!.y).toBeGreaterThanOrEqual(0);
  expect(timerBox!.y + timerBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 12);
  expect(timerBox!.x + timerBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await restTimer.getByRole('button', { name: 'Resume rest timer', exact: true }).click();
  await expect(
    restTimer.getByRole('button', { name: 'Pause rest timer', exact: true }),
  ).toBeVisible();
  const tonesBeforeExpiry = await page.evaluate(
    () => (window as typeof window & { tonesStarted: number }).tonesStarted,
  );
  await page.clock.install();
  await page.clock.fastForward(120000);
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { tonesStarted: number }).tonesStarted),
    )
    .toBe(tonesBeforeExpiry + 1);

  await page.screenshot({
    path: `test-results/active-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page.getByText('Workout options', { exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('Rest paused', { exact: false })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'End rest', exact: true }).click();
  await page.getByText('Workout options', { exact: true }).click();
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
  await expect(page.getByText('Planned 6–8 reps', { exact: false })).toBeVisible();
  await page.getByLabel('Corrected weight').fill('24');
  await page.getByRole('combobox', { name: 'Set type', exact: true }).click();
  await page.getByRole('option', { name: 'Normal', exact: true }).click();
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText('24 kg × 9', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('region', { name: 'All-time exercise statistics' })).toContainText(
    '24kg',
  );
  await expect(page.getByRole('region', { name: 'All-time exercise statistics' })).toContainText(
    '31.2kg',
  );
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
  await page.getByRole('button', { name: 'Start set 1', exact: true }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('24');
  await page.reload();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('24');
  // Clearing a suggestion is an intentional draft; it stays empty after reload.
  await page.getByLabel('Set 1 actual kg').fill('');
  await page.reload();
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
  // Today's completed set supplies both values even though this slot was skipped last workout.
  await page.getByRole('button', { name: 'Start set 2', exact: true }).click();
  await expect(page.getByLabel('Set 2 actual kg')).toHaveValue('40');
  await expect(page.getByLabel('Set 2 actual reps')).toHaveValue('8');
  const nextState = await (await page.request.get('/api/state')).json();
  expect(nextState.activeWorkout.exercises[0].sets[1].actual_grams).toBeNull();
  const w = nextState.activeWorkout;
  const requests = await Promise.all(
    [1, 2].map(() =>
      page.request.post('/api/command', {
        headers: { 'x-auctus-account': nextState.account.id, origin: 'http://localhost:3100' },
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
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  await page.getByText('Workout options', { exact: true }).click();
  await page.getByRole('button', { name: 'Abandon workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm abandon', exact: true }).click();
  await verifyPerSetWeightHistory(page);
  await page.getByRole('button', { name: 'Account settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rest alerts', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enable background alerts', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Background alerts become available', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Test alarm|Test notification|Stop alarm/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute timer sound', exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/rest-alert-settings-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Put in the work. See your progress.' }),
  ).toBeVisible();
  expect((await page.request.get('/api/state')).status()).toBe(401);
});

test('rejects unauthenticated reads, cross-origin writes and public signup', async ({
  request,
}) => {
  expect((await request.get('/api/state')).status()).toBe(401);
  expect((await request.get('/api/push')).status()).toBe(401);
  expect(
    (
      await request.post('/api/push', {
        headers: { origin: 'https://attacker.example' },
        data: { action: 'subscribe' },
      })
    ).status(),
  ).toBe(403);
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
