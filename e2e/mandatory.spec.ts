import { test, expect } from '@playwright/test';

test('all workouts advance weekly progress while mandatory workouts determine week completion', async ({
  page,
}, info) => {
  await page.goto('/login/account');
  await page.getByLabel('Email', { exact: true }).fill('mandatory@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-only-mandatory-password');
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
    ['Extra time workout', false],
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
  await expect(page.getByText('0 of 1 mandatory workouts completed.', { exact: true })).toHaveText(
    '0 of 1 mandatory workouts completed.',
  );
  await expect(page.getByRole('progressbar', { name: 'Weekly workout progress' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await expect(page.getByRole('progressbar', { name: 'Weekly workout progress' })).toHaveAttribute(
    'aria-valuemax',
    '3',
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
    .getByRole('heading', { name: 'Extra training', exact: true })
    .locator('..')
    .locator('..')
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
  await expect(page.getByText('0 of 1 mandatory workouts completed.', { exact: true })).toHaveText(
    '0 of 1 mandatory workouts completed.',
  );
  await expect(page.getByRole('progressbar', { name: 'Weekly workout progress' })).toHaveAttribute(
    'aria-valuenow',
    '1',
  );
  await expect(page.getByText('Week done.', { exact: true })).toHaveCount(0);
  const requiredAssignment = state.assignments.find(
    (a: { name: string }) => a.name === 'Required training',
  );
  const requiredWorkout = await command('workout.start', { assignment_id: requiredAssignment.id });
  await command('session.action', {
    workout_id: requiredWorkout.id,
    version: requiredWorkout.version,
    action: 'workout.complete',
    skipRemaining: true,
  });
  await page.reload();
  await expect(page.getByText('Week done.', { exact: true })).toHaveText('Week done.');
  await expect(page.getByRole('progressbar', { name: 'Weekly workout progress' })).toHaveAttribute(
    'aria-valuenow',
    '2',
  );
  await expect(page.getByRole('progressbar', { name: 'Weekly workout progress' })).toHaveAttribute(
    'aria-valuemax',
    '3',
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: info.outputPath(`week-done-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.setViewportSize(info.project.use.viewport!);
  await nav.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.workout-requirement')).toHaveText(['Mandatory', 'Optional']);
});
