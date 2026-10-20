import { test, expect } from '@playwright/test';
import type { State } from '../src/domain/types';

test('Quick Switch preserves prescriptions, restores focus and survives reload', async ({
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

  const replacementName = `Replacement ${suffix}`;
  const replacement = await send('exercise.save', { name: replacementName, equipment: 'dumbbell' });
  const before = state.activeWorkout!.exercises[0];
  try {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Quick Switch', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Quick Switch', exact: true });
    await dialog.getByRole('searchbox', { name: 'Search exercises' }).fill('no-match-exercise');
    await expect(dialog.getByRole('status')).toHaveText('No exercises found.');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');
    await dialog.getByRole('searchbox', { name: 'Search exercises' }).fill(replacementName);
    await page.screenshot({ path: testInfo.outputPath('quick-switch-menu.png') });
    let fail = true;
    await page.route('**/api/command', (route) =>
      fail
        ? route.fulfill({ status: 503, json: { error: 'Connection interrupted.' } })
        : route.continue(),
    );
    await dialog.getByRole('button', { name: `${replacementName} Dumbbells`, exact: true }).click();
    await expect(dialog.locator('.toast.error')).toContainText('Connection interrupted.');
    fail = false;
    await dialog.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('heading', { name: replacementName, exact: true })).toBeVisible();
    state = await (await page.request.get('/api/state')).json();
    expect(state.activeWorkout!.exercises[0]).toEqual({
      ...before,
      exercise_id: replacement.id,
      name: replacementName,
      equipment: 'dumbbell',
    });
    expect(state.templates.find((item) => item.id === template.id)!.exercises[0].exercise_id).toBe(
      exercise.id,
    );
    await page.reload();
    await expect(page.getByRole('heading', { name: replacementName, exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('quick-switch.png'), fullPage: true });
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
