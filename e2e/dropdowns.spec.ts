import { test, expect } from '@playwright/test';

test('custom menus create exercises in place and preserve template and training context', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('athlete@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-only-training-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const nav = page.getByRole('navigation', {
    name: page.viewportSize()!.width < 760 ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
  await nav.getByRole('button', { name: 'Programs' }).click();
  await page.getByRole('button', { name: 'New program', exact: true }).click();
  const program = `Inline creation ${Date.now()}`;
  await page.getByLabel('Name', { exact: true }).fill(program);
  await page.getByRole('button', { name: 'Save program' }).click();
  await page
    .getByRole('heading', { name: program, exact: true })
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Open program' })
    .click();
  await page.getByRole('button', { name: 'New workout' }).click();
  await page.getByLabel('Workout name').fill('Upper body strength');
  await page.getByLabel('Workout notes').fill('Keep these unsaved cues.');
  const picker = page.getByRole('combobox', { name: 'Add exercise', exact: true });
  await picker.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('option', { name: 'Create exercise', exact: true })).toBeInViewport();
  await page.screenshot({
    path: `test-results/exercise-menu-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await picker.click();
    await expect(
      page.getByRole('option', { name: 'Create exercise', exact: true }),
    ).toBeInViewport();
    await expect
      .poll(async () => {
        const box = await page.getByRole('listbox').boundingBox();
        return !!box && box.x >= 0 && box.x + box.width <= width;
      })
      .toBe(true);
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize(test.info().project.use.viewport!);
  await expect(picker).toBeFocused();
  await picker.click();
  await page.getByRole('option', { name: 'Create exercise', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create exercise', exact: true });
  await expect(dialog.getByLabel('Exercise name')).toBeFocused();
  await dialog.getByLabel('Exercise name').fill('Cancelled exercise');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(picker).toBeFocused();
  await expect(page.getByLabel('Workout name')).toHaveValue('Upper body strength');
  await expect(page.getByLabel('Workout notes')).toHaveValue('Keep these unsaved cues.');
  await picker.click();
  await page.getByRole('option', { name: 'Create exercise', exact: true }).click();
  await dialog.getByLabel('Exercise name').fill('Incline dumbbell press');
  await dialog.getByLabel('Details / technique notes').fill('Bench at 30 degrees.');
  await page.screenshot({
    path: `test-results/create-exercise-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return !!box && box.x >= 0 && box.x + box.width <= width;
      })
      .toBe(true);
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await page.setViewportSize(test.info().project.use.viewport!);
  // Failed creation keeps both the dialog input and the unsaved parent workout.
  await page.route(
    '**/api/command',
    (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Please retry this test validation failure.' }),
      }),
    { times: 1 },
  );
  await dialog.getByRole('button', { name: 'Create and select' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Exercise name')).toHaveValue('Incline dumbbell press');

  await dialog.getByRole('button', { name: 'Create and select' }).click();
  await expect(dialog).toBeHidden();
  await expect(picker).toContainText('Incline dumbbell press');
  await expect(page.getByLabel('Workout name')).toHaveValue('Upper body strength');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  const type = page.getByRole('combobox', { name: 'Set 1 type', exact: true });
  await type.click();
  await page.getByRole('option', { name: 'Warm-up', exact: true }).click();
  await expect(type).toContainText('Warm-up');
  await type.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Warm-up', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('option', { name: 'Failure', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(type).toContainText('Failure');
  expect(
    await page
      .getByRole('combobox')
      .evaluateAll((nodes) => nodes.every((node) => node.tagName === 'BUTTON')),
  ).toBe(true);
  await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await page.getByRole('button', { name: 'Use this program' }).click();
  await nav.getByRole('button', { name: 'Overview' }).click();
  await page
    .getByRole('button', { name: 'Start workout', exact: true })
    .and(page.locator(':enabled'))
    .click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  const activePicker = page.getByRole('combobox', { name: 'Exercise', exact: true });
  await activePicker.click();
  await page.getByRole('option', { name: 'Create exercise', exact: true }).click();
  await dialog.getByLabel('Exercise name').fill('Cable lateral raise');
  await dialog.getByRole('button', { name: 'Create and select' }).click();
  await expect(activePicker).toContainText('Cable lateral raise');
  await page.getByRole('button', { name: 'Add to workout', exact: true }).click();
  const state = await (await page.request.get('/api/state')).json();
  expect(state.activeWorkout.exercises.map((e: { name: string }) => e.name)).toEqual([
    'Incline dumbbell press',
    'Cable lateral raise',
  ]);
  expect(state.activeWorkout.exercises[0].sets[0].type).toBe('failure');
  expect(
    state.templates.find((t: { id: string }) => t.id === state.activeWorkout.template_id).notes,
  ).toBe('Keep these unsaved cues.');
  expect(state.exercises.some((e: { name: string }) => e.name === 'Cancelled exercise')).toBe(
    false,
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue workout' }).click();
  await expect(page.getByRole('button', { name: /^02 Cable lateral raise/ })).toBeVisible();
  await page.getByRole('button', { name: 'Abandon workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm abandon', exact: true }).click();
  expect(errors).toEqual([]);
});
