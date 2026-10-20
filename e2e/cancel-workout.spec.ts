import { test, expect } from '@playwright/test';
import type { State } from '../src/domain/types';

test('cancels an accidental workout before or after abandonment without a history entry', async ({
  page,
}, info) => {
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
    await send('workout.cancel', {
      workout_id: state.activeWorkout.id,
      version: state.activeWorkout.version,
    });
  const exercise = await send('exercise.save', { name: 'Cancel check row' });
  const program = await send('program.save', { name: 'Cancel check' });
  const template = await send('template.save', {
    program_id: program.id,
    name: 'Accidental workout',
    exercises: [
      {
        exercise_id: exercise.id,
        sets: [{ type: 'normal', min_reps: 8, max_reps: 8, rest_ms: 1000 }],
      },
    ],
  });
  await send('program.select', { id: program.id });
  const assignment = state.assignments.find((a) => a.template_id === template.id)!;
  const first = await send('workout.start', { assignment_id: assignment.id });

  await page.goto('/');
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Cancel this workout?' });
  await expect(confirm).toContainText('will be deleted');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('active-cancel.png'), animations: 'disabled' });
  await confirm.getByRole('button', { name: 'Keep training' }).click();
  await expect(page.getByRole('heading', { name: 'Accidental workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
  await confirm.getByRole('button', { name: 'Confirm cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Make today count.' })).toBeVisible();
  state = await (await page.request.get('/api/state')).json();
  expect(state.activeWorkout).toBeNull();
  expect(state.history.some((w) => w.id === first.id)).toBe(false);
  expect(state.assignments.find((a) => a.id === assignment.id)?.completed).toBe(0);

  const second = await send('workout.start', { assignment_id: assignment.id });
  await send('session.action', {
    workout_id: second.id,
    version: second.version,
    action: 'workout.abandon',
  });
  await page.reload();
  const nav = page.getByRole('navigation', {
    name: page.viewportSize()!.width < 760 ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
  await nav.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
  await page.screenshot({ path: info.outputPath('history-cancel.png'), animations: 'disabled' });
  await page
    .getByRole('dialog', { name: 'Cancel this workout?' })
    .getByRole('button', { name: 'Confirm cancel' })
    .click();
  await expect(page.getByText('Your story is just beginning.')).toBeVisible();
  state = await (await page.request.get('/api/state')).json();
  expect(state.history.some((w) => w.id === second.id)).toBe(false);
  expect(errors).toEqual([]);
});
