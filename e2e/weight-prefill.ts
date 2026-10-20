import { expect, type Page } from '@playwright/test';

export async function verifyPerSetWeightHistory(page: Page) {
  async function command(action: string, data: Record<string, unknown>) {
    const account = (await (await page.request.get('/api/state')).json()).account;
    const response = await page.request.post('/api/command', {
      headers: { 'x-auctus-account': account.id, origin: 'http://localhost:3100' },
      data: { requestId: crypto.randomUUID(), action, data },
    });
    const body = await response.json();
    expect(response.ok(), `${action}: ${body.error ?? response.status()}`).toBe(true);
    return body;
  }
  const { result: exercise } = await command('exercise.save', {
    name: 'Prefill press ' + Date.now(),
  });
  const { result: program } = await command('program.save', {
    name: 'Prefill program ' + Date.now(),
  });
  const plan = { type: 'normal', min_reps: 6, max_reps: 8, rest_ms: 60000 };
  const { result: template } = await command('template.save', {
    program_id: program.id,
    name: 'Own set weights',
    exercises: [{ exercise_id: exercise.id, sets: [{ ...plan, type: 'warmup' }, plan, plan] }],
  });
  const selected = await command('program.select', { id: program.id });
  const assignment = selected.state.assignments.find(
    (a: { template_id: string }) => a.template_id === template.id,
  );
  const started = await command('workout.start', { assignment_id: assignment.id, repeat: false });
  let workout = started.state.activeWorkout;
  async function act(action: string, data: Record<string, unknown> = {}) {
    const response = await command('session.action', {
      workout_id: workout.id,
      version: workout.version,
      action,
      ...data,
    });
    workout = response.state.activeWorkout;
  }
  await act('exercise.start', { id: workout.exercises[0].id });
  for (const [i, grams] of [15000, 30000, 35000].entries()) {
    const id = workout.exercises[0].sets[i].id;
    await act('set.start', { id });
    expect(workout.exercises[0].sets[i].prefill_grams).toBe(i === 2 ? 30000 : null);
    expect(workout.exercises[0].sets[i].prefill_reps).toBe(i === 2 ? 8 : null);
    await act('set.complete', { id, actual_grams: grams, actual_reps: 8 });
  }
  await act('workout.complete', { skipRemaining: true });
  workout = (await command('workout.start', { assignment_id: assignment.id, repeat: true })).state
    .activeWorkout;
  await act('workout.complete', { skipRemaining: true });
  // A new template must still find older exercise history past the skipped workout.
  const { result: alternate } = await command('template.save', {
    program_id: program.id,
    name: 'Another day, same exercise',
    exercises: [{ exercise_id: exercise.id, sets: [{ ...plan, type: 'warmup' }, plan, plan] }],
  });
  const scheduled = await command('program.select', { id: program.id });
  const alternateAssignment = scheduled.state.assignments.find(
    (a: { template_id: string }) => a.template_id === alternate.id,
  );
  await command('workout.start', { assignment_id: alternateAssignment.id });
  await page.reload();
  await page.getByRole('button', { name: 'Start set 1', exact: true }).click();
  await expect(page.getByLabel('Set 1 actual kg')).toHaveValue('15');
  await expect(
    page.getByText('Latest completed warm-up set: 15 kg × 8 reps. Adjust if needed.'),
  ).toBeVisible();
  await expect(page.getByLabel('Set 1 actual reps')).toHaveValue('8');
  await page.getByLabel('Set 1 actual kg').fill('17');
  await page.getByLabel('Set 1 actual reps').fill('8');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await page.getByRole('button', { name: 'Start set 2', exact: true }).click();
  await expect(page.getByLabel('Set 2 actual kg')).toHaveValue('35');
  await expect(page.getByLabel('Set 2 actual reps')).toHaveValue('8');
  await page.getByLabel('Set 2 actual kg').fill('40');
  await page.getByLabel('Set 2 actual reps').fill('7');
  await page.reload();
  await expect(page.getByLabel('Set 2 actual kg')).toHaveValue('40');
  await expect(page.getByLabel('Set 2 actual reps')).toHaveValue('7');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await page.getByRole('button', { name: 'Start set 3', exact: true }).click();
  await expect(page.getByLabel('Set 3 actual kg')).toHaveValue('40');
  await expect(page.getByLabel('Set 3 actual reps')).toHaveValue('7');
  const state = await (await page.request.get('/api/state')).json();
  expect(
    state.activeWorkout.exercises[0].sets.map(
      (s: { actual_grams: number | null }) => s.actual_grams,
    ),
  ).toEqual([17000, 40000, null]);
  workout = state.activeWorkout;
  await act('workout.abandon');
  await page.reload();
}
