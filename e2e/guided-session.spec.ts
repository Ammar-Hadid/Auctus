import { test, expect } from '@playwright/test';
import type { State } from '../src/domain/types';

test('guided gym journey keeps the current set visible and preserves full session controls', async ({
  page,
}) => {
  const origin = 'http://localhost:3100';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.request.post('/api/auth/sign-in/email', {
    headers: { origin },
    data: { email: 'athlete@example.test', password: 'test-only-training-password' },
  });
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
  const planned = [];
  for (const name of [
    'Incline Dumbbell Press',
    'Chest-Supported Row',
    'Leg Press',
    'Seated Leg Curl',
    'Lateral Raise',
    'Triceps Pushdown',
    'Standing Calf Raise',
  ]) {
    const exercise = await send('exercise.save', {
      name,
      equipment: name === 'Incline Dumbbell Press' ? 'dumbbell' : 'stack_machine',
    });
    planned.push({
      exercise_id: exercise.id,
      sets: Array.from({ length: 3 }, (_, i) => ({
        type: i === 0 ? 'warmup' : 'normal',
        min_reps: 6,
        max_reps: 10,
        rest_ms: 90000,
      })),
    });
  }
  const program = await send('program.save', { name: 'Guided journey' });
  const template = await send('template.save', {
    program_id: program.id,
    name: 'Iron Foundation',
    mandatory: true,
    exercises: planned,
  });
  await send('program.select', { id: program.id });
  await send('workout.start', {
    assignment_id: state.assignments.find((a) => a.template_id === template.id)!.id,
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Incline Dumbbell Press', exact: true }),
  ).toBeVisible();
  // Seven exercises no longer precede the first actionable set. All phone widths can start immediately.
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 720 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('button', { name: 'Start set 1', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const button = (await page
      .getByRole('button', { name: 'Start set 1', exact: true })
      .boundingBox())!;
    const nav = page.getByRole('navigation', { name: 'Mobile navigation', exact: true });
    if (width <= 760) expect(button.y + button.height).toBeLessThan((await nav.boundingBox())!.y);
  }
  await page.setViewportSize({ width: 390, height: 720 });
  await page.getByRole('button', { name: 'Start set 1', exact: true }).click();
  await page.getByLabel('Set 1 actual kg').fill('15');
  await page.getByLabel('Set 1 actual reps').fill('8');
  await page.getByRole('button', { name: 'Workout overview', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Workout overview', exact: true });
  await expect(dialog.getByRole('button', { name: /Leg Press/ })).toBeVisible();
  await dialog.getByRole('button', { name: /Leg Press/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.exercise-focus-area')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Start set 1', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /Return to your active set/ }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('15');
  await page.reload();
  await expect(page.getByLabel('Set 1 actual reps')).toHaveValue('8');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'View set 1, Completed', exact: true }),
  ).toContainText('15 kg × 8');
  await expect(page.getByRole('button', { name: 'Start set 2', exact: true })).toBeVisible();
  const timer = page.getByRole('region', { name: 'Rest timer' });
  await expect(timer).toBeVisible();
  await page.screenshot({
    path: `/tmp/auctus-guided-rest-${test.info().project.name}.png`,
    scale: 'css',
  });
  await timer.getByRole('button', { name: 'Collapse rest timer' }).click();
  await expect(timer.getByRole('button', { name: 'End rest', exact: true })).toBeVisible();
  await page.reload();
  await expect(timer.getByRole('button', { name: 'Expand rest timer' })).toBeVisible();
  for (const [index, kg] of [
    [2, '30'],
    [3, '32.5'],
  ] as const) {
    await page.getByRole('button', { name: `Start set ${index}`, exact: true }).click();
    await expect(timer).not.toBeVisible();
    await expect(page.getByLabel(`Set ${index} actual kg`)).toHaveValue('');
    await page.getByLabel(`Set ${index} actual kg`).fill(kg);
    await page.getByLabel(`Set ${index} actual reps`).fill('8');
    await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Exercise finished', exact: true })).toBeVisible();
  await expect(timer).toBeVisible();
  state = await (await page.request.get('/api/state')).json();
  expect(state.activeWorkout!.exercises[0].status).toBe('completed');
  expect(state.activeWorkout!.exercises[1].sets[0].started_at).toBeNull();
  await page.screenshot({
    path: `/tmp/auctus-guided-finished-${test.info().project.name}.png`,
    scale: 'css',
  });
  // Corrections are deliberately available from the row, without changing the next step.
  await page.getByRole('button', { name: 'View set 1, Completed', exact: true }).click();
  await page.getByText('Set options', { exact: true }).click();
  await page.getByRole('button', { name: 'Correct result', exact: true }).click();
  await page.locator('.set-options input[name="kg"]').fill('16');
  await page.getByRole('button', { name: 'Save set changes', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'View set 1, Completed', exact: true }),
  ).toContainText('16 kg × 8');
  // Reopen the completed exercise and keep its existing results.
  const exerciseOptions = page.getByRole('button', { name: 'Exercise options', exact: true });
  await exerciseOptions.click();
  const options = page.getByRole('dialog', { name: 'Exercise options', exact: true });
  await expect(options).toContainText('Changes here apply to this workout only.');
  await options.getByText('Previous workout & technique', { exact: true }).click();
  await expect(options).toContainText('No technique notes.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('exercise-options-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('exercise-options-desktop.png') });
  await page.setViewportSize({ width: 390, height: 720 });
  await options.getByText('Reorder sets', { exact: true }).click();
  await options.getByRole('button', { name: 'Move set 2 up' }).click();
  await expect(options.getByText('Set 1 · Working', { exact: true })).toBeVisible();
  await options.getByRole('button', { name: 'Close exercise options' }).click();
  await expect(exerciseOptions).toBeFocused();
  await exerciseOptions.click();
  await options.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  const remove = page.getByRole('dialog', { name: 'Remove this exercise?' });
  await expect(remove).toBeVisible();
  await remove.getByRole('button', { name: 'Keep training' }).click();
  await exerciseOptions.click();
  await options.getByRole('button', { name: 'Add set', exact: true }).click();
  await expect(options).not.toBeVisible();
  await page.getByRole('button', { name: 'Start set 4', exact: true }).click();
  await page.getByText('Set options', { exact: true }).click();
  await page.getByRole('button', { name: 'Skip set', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'View set 4, Skipped', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start next exercise', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Chest-Supported Row', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Set 1 actual kg')).toBeVisible();
  await page.getByText('Workout options', { exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toBeDisabled();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toBeEnabled();
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  await page.getByRole('button', { name: 'Abandon workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm abandon', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make today count.' })).toBeVisible();
  expect(errors).toEqual([]);
});
