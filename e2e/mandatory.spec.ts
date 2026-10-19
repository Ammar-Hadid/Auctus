import { test, expect } from '@playwright/test';

test('mandatory and optional workouts are editable, visible and counted separately', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('athlete@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-only-training-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make today count.', exact: true })).toBeVisible();
  let state = await (await page.request.get('/api/state')).json();
  const command = async (action: string, data: Record<string, unknown>) => {
    const response = await page.request.post('/api/command', {
      headers: { origin: 'http://localhost:3100', 'x-auctus-account': state.account.id },
      data: { requestId: crypto.randomUUID(), action, data },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    state = body.state;
    return body.result;
  };
  const exercise = await command('exercise.save', { name: 'Press', equipment: 'dumbbell' });
  const nav = page.getByRole('navigation', {
    name: page.viewportSize()!.width < 760 ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
  await nav.getByRole('button', { name: 'Programs', exact: true }).click();
  await page.getByRole('button', { name: 'New program', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Mandatory check');
  await page.getByRole('button', { name: 'Save program', exact: true }).click();
  await page.getByRole('button', { name: 'Open program', exact: true }).click();
  await page.reload();
  await nav.getByRole('button', { name: 'Programs', exact: true }).click();
  await page.getByRole('button', { name: 'Open program', exact: true }).click();
  for (const [name, mandatory] of [
    ['Required training', true],
    ['Extra training', false],
  ] as const) {
    await page.getByRole('button', { name: 'New workout', exact: true }).click();
    await page.getByLabel('Workout name').fill(name);
    await expect(page.getByRole('combobox', { name: 'Mandatory', exact: true })).toContainText(
      'Yes — mandatory',
    );
    if (!mandatory) {
      await page.getByRole('combobox', { name: 'Mandatory', exact: true }).click();
      await page.getByRole('option', { name: 'No — optional', exact: true }).click();
      await page.screenshot({
        path: info.outputPath('mandatory-editor.png'),
        animations: 'disabled',
      });
    }
    await page.getByRole('combobox', { name: 'Add exercise', exact: true }).click();
    await page.getByRole('combobox', { name: 'Add exercise', exact: true }).fill('Press');
    await page.getByRole('option', { name: 'Press', exact: true }).click();
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await page.getByRole('button', { name: 'Save workout', exact: true }).click();
    await expect(
      page
        .locator('.list-row')
        .filter({ has: page.getByRole('heading', { name, exact: true }) })
        .locator('.workout-requirement'),
    ).toHaveText(mandatory ? 'Mandatory' : 'Optional');
  }
  const optionalRow = page
    .locator('.list-row')
    .filter({ has: page.getByRole('heading', { name: 'Extra training', exact: true }) });
  await optionalRow.getByRole('button', { name: 'Edit workout', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Mandatory', exact: true })).toContainText(
    'No — optional',
  );
  await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await page.getByRole('button', { name: 'Use this program', exact: true }).click();
  await nav.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.locator('.weekly-goal-summary')).toHaveText(
    '0 of 1 mandatory workouts completed. 0 of 1 optional workouts completed.',
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`mandatory-dashboard-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.setViewportSize(info.project.use.viewport!);
  await page
    .locator('.workout-row')
    .filter({ has: page.getByRole('heading', { name: 'Extra training', exact: true }) })
    .getByRole('button', { name: 'Start workout', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Extra training', level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.locator('.workout-requirement')).toHaveText('Optional');
  state = await (await page.request.get('/api/state')).json();
  expect(state.activeWorkout.mandatory).toBe(false);
  expect(state.activeWorkout.exercises[0].exercise_id).toBe(exercise.id);
  await command('session.action', {
    workout_id: state.activeWorkout.id,
    version: state.activeWorkout.version,
    action: 'workout.complete',
    skipRemaining: true,
  });
  await page.reload();
  await expect(page.locator('.weekly-goal-summary')).toHaveText(
    '0 of 1 mandatory workouts completed. 1 of 1 optional workouts completed.',
  );
  await nav.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.workout-requirement')).toHaveText('Optional');
});
