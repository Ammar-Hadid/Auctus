import { test, expect } from '@playwright/test';
import type { State } from '../src/domain/types';

test('expired rest rings until End rest and stays ended after reload', async ({ page }) => {
  await page.addInitScript(() => {
    const tracker = { starts: 0, stops: 0, looping: false };
    Object.assign(window, { alarmAudio: tracker });
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source),
        stop = source.stop.bind(source);
      source.start = (when?: number) => {
        tracker.starts++;
        tracker.looping = source.loop;
        start(when);
      };
      source.stop = (when?: number) => {
        tracker.stops++;
        stop(when);
      };
      return source;
    };
  });
  const origin = 'http://localhost:3100';
  expect(
    (
      await page.request.post('/api/auth/sign-in/email', {
        headers: { origin },
        data: { email: 'alarm@example.test', password: 'test-only-alarm-password' },
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
  const exercise = await send('exercise.save', { name: 'Alarm exercise' });
  const program = await send('program.save', { name: 'Alarm program' });
  const template = await send('template.save', {
    program_id: program.id,
    name: 'Alarm workout',
    exercises: [
      {
        exercise_id: exercise.id,
        sets: [1, 2].map(() => ({ type: 'normal', min_reps: 1, max_reps: 1, rest_ms: 5000 })),
      },
    ],
  });
  await send('program.select', { id: program.id });
  await send('workout.start', {
    assignment_id: state.assignments.find((a) => a.template_id === template.id)!.id,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue workout', exact: true }).click();
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Start set 1', exact: true }).click();
  await page.getByLabel('Set 1 actual kg').fill('1');
  await page.getByLabel('Set 1 actual reps').fill('1');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  const timer = page.getByRole('region', { name: 'Rest timer' });
  const end = timer.getByRole('button', { name: 'End rest', exact: true });
  await expect(timer.getByRole('button', { name: 'Stop alarm', exact: true })).toHaveCount(0);
  await expect(timer.getByRole('button', { name: 'Test alarm', exact: true })).toHaveCount(0);
  await timer.getByRole('button', { name: 'Enable sound', exact: true }).click();
  const audio = () =>
    page.evaluate(
      () =>
        (
          window as typeof window & {
            alarmAudio: { starts: number; stops: number; looping: boolean };
          }
        ).alarmAudio,
    );
  expect(await audio()).toEqual({ starts: 0, stops: 0, looping: false });
  await expect.poll(audio, { timeout: 8000 }).toEqual({ starts: 1, stops: 0, looping: true });
  // More than a full two-second cycle passes without an automatic stop.
  await expect(timer.getByRole('timer')).toHaveText('+00:03', { timeout: 6000 });
  expect((await audio()).stops).toBe(0);
  await page.screenshot({
    path: `test-results/alarm-${test.info().project.name}.png`,
    fullPage: true,
  });
  await end.click();
  await expect(timer).toHaveCount(0);
  expect(await audio()).toEqual({ starts: 1, stops: 1, looping: true });
  await page.reload();
  await page.getByRole('button', { name: 'Continue workout', exact: true }).click();
  await expect(timer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start set 2', exact: true })).toBeVisible();
  expect((await audio()).starts).toBe(0);
});
