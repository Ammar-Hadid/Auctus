import { test, expect } from '@playwright/test';
import type { State } from '../src/domain/types';

test('workout overview supports search, nested creation and accessible save recovery', async ({
  page,
}, testInfo) => {
  const origin = 'http://localhost:3100';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  expect(
    (
      await page.request.post('/api/auth/sign-in/email', {
        headers: { origin },
        data: { email: 'athlete@example.test', password: 'test-only-training-password' },
      })
    ).status(),
  ).toBe(200);
  let state: State = await (await page.request.get('/api/state')).json();
  const send = async (action: string, data: Record<string, unknown>) => {
    const response = await page.request.post('/api/command', {
      headers: { origin, 'x-auctus-account': state.account.id },
      data: { requestId: crypto.randomUUID(), action, data },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    state = body.state;
    return body.result;
  };
  if (state.activeWorkout)
    await send('session.action', {
      workout_id: state.activeWorkout.id,
      version: state.activeWorkout.version,
      action: 'workout.abandon',
    });
  const suffix = `${testInfo.project.name} ${Date.now()}`;
  const name = `Dialog row ${suffix}`;
  const exercise = await send('exercise.save', { name, equipment: 'stack_machine' });
  const program = await send('program.save', { name: `Dialog program ${suffix}` });
  const template = await send('template.save', {
    program_id: program.id,
    name: `Dialog workout ${suffix}`,
    mandatory: true,
    exercises: [
      {
        exercise_id: exercise.id,
        sets: [{ type: 'normal', min_reps: 6, max_reps: 10, rest_ms: 90000 }],
      },
    ],
  });
  await send('program.select', { id: program.id });
  await send('workout.start', {
    assignment_id: state.assignments.find((item) => item.template_id === template.id)!.id,
  });

  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Workout overview', exact: true }).click();
    const overview = page.getByRole('dialog', { name: 'Workout overview', exact: true });
    await overview.getByRole('button', { name: 'Add exercise', exact: true }).click();
    const search = overview.getByRole('combobox', { name: 'Exercise', exact: true });
    await search.fill(name);
    const option = overview.getByRole('option', { name, exact: true });
    await expect(option).toBeVisible();
    // A normal pointer click must work through the modal; no force/DOM click workaround.
    await option.click();
    await expect(search).toHaveValue(name);
    await overview.getByRole('button', { name: 'Add to workout', exact: true }).click();
    await expect(overview.locator('.overview-exercise')).toHaveCount(2);

    await overview.getByRole('button', { name: 'Add exercise', exact: true }).click();
    const createdName = `Dialog cable ${suffix}`;
    await search.fill(createdName);
    // The same scoped menu also supports keyboard selection of its create action.
    await search.press('ArrowDown');
    await search.press('Enter');
    const create = page.getByRole('dialog', { name: 'Create exercise', exact: true });
    await expect(create.getByLabel('Exercise name', { exact: true })).toHaveValue(createdName);
    await create.getByRole('combobox', { name: 'Equipment', exact: true }).click();
    await page.getByRole('option', { name: 'Cable machine', exact: true }).click();
    await create.getByRole('button', { name: 'Create and select', exact: true }).click();
    await expect(create).toHaveCount(0);
    await expect(search).toHaveValue(createdName);
    await expect(search).toBeFocused();

    let fail = true;
    await page.route('**/api/command', (route) =>
      fail
        ? route.fulfill({
            status: 503,
            json: { error: 'Connection interrupted. Retry this save.' },
          })
        : route.continue(),
    );
    await overview.getByRole('button', { name: 'Add to workout', exact: true }).click();
    await expect(overview.locator('.toast.error')).toContainText('Connection interrupted');
    await expect(overview.locator('.toast-viewport')).toHaveCSS('position', 'fixed');
    const retry = overview.getByRole('button', { name: 'Retry save', exact: true });
    await retry.focus();
    await expect(retry).toBeFocused();
    fail = false;
    await page.keyboard.press('Enter');
    await expect(overview.locator('.toast')).toHaveCount(0);
    await expect(overview.locator('.overview-exercise')).toHaveCount(3);
    await expect(overview.getByRole('button', { name: new RegExp(createdName) })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.unroute('**/api/command');
    state = await (await page.request.get('/api/state')).json();
    if (state.activeWorkout)
      await send('session.action', {
        workout_id: state.activeWorkout.id,
        version: state.activeWorkout.version,
        action: 'workout.abandon',
      });
  }
});
