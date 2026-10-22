import { test, expect, type Page } from '@playwright/test';
import type { State } from '../src/domain/types';

async function enter(page: Page) {
  const result = await page.request.post('/api/showcase', {
    headers: { origin: 'http://localhost:3100' },
    data: { action: 'enter', code: 'test-only-showcase-code' },
  });
  expect(result.ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make today count.' })).toBeVisible();
}
function nav(page: Page) {
  return page.getByRole('navigation', {
    name: page.viewportSize()!.width <= 760 ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
}

test('every library exercise has weekly statistics, rep records and original session links', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enter(page);
  const state: State = await (await page.request.get('/api/state')).json();
  await nav(page).getByRole('button', { name: 'Library', exact: true }).click();
  for (const exercise of state.exercises) {
    const row = page
      .locator('.list-row')
      .filter({ has: page.getByRole('heading', { name: exercise.name, exact: true }) });
    await expect(row).toContainText('Latest top set:');
    await row.getByRole('button', { name: `Progress for ${exercise.name}`, exact: true }).click();
    await expect(page.getByRole('heading', { name: exercise.name, exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your weekly progress' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your rep records' })).toBeVisible();
    await page.getByRole('button', { name: 'Exercise library', exact: true }).click();
  }
  const exercise = state.exercises.find((e) => e.name === 'Incline dumbbell press')!;
  await page.getByRole('button', { name: `Progress for ${exercise.name}` }).click();
  const chart = page.getByRole('region', { name: 'Your weekly progress' });
  await chart.getByText('Weekly breakdown · exact values').focus();
  await page.keyboard.press('Enter');
  await expect(chart.getByRole('table')).toContainText('26 kg × 11');
  await expect(chart.getByRole('table')).toContainText('No working sets');
  await chart.getByRole('combobox', { name: 'Metric', exact: true }).click();
  await page.getByRole('option', { name: 'Working volume', exact: true }).click();
  await expect(chart.getByRole('img')).toHaveAttribute('aria-label', /^Working volume/);
  await expect(chart.getByRole('button', { name: 'Later eight training weeks' })).toBeDisabled();
  await expect(chart.getByRole('button', { name: 'Earlier eight training weeks' })).toBeDisabled();
  await chart.getByText('Weekly breakdown · exact values').click();
  await chart.getByRole('combobox', { name: 'Metric', exact: true }).click();
  await page.getByRole('option', { name: 'Recorded weight', exact: true }).click();
  const history = page.getByRole('region', { name: 'Session history' });
  await history.getByRole('button', { name: 'Older exercise sessions' }).click();
  await expect(history).toContainText('Page 2 of 3');
  await history.getByRole('button', { name: 'Newer exercise sessions' }).click();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`exercise-progress-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.getByRole('button', { name: 'View 8-rep record: 20 kilograms', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit workout', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Incline dumbbell press', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('untrained and archived exercises remain accessible and zero-weight work defaults to reps', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enter(page);
  const state: State = await (await page.request.get('/api/state')).json();
  async function command(action: string, data: Record<string, unknown>) {
    const response = await page.request.post('/api/command', {
      headers: { origin: 'http://localhost:3100', 'x-auctus-account': state.account.id },
      data: { requestId: crypto.randomUUID(), action, data },
    });
    const body = await response.json();
    expect(response.ok(), body.error).toBe(true);
    return body.result;
  }
  const exercise = await command('exercise.save', { name: 'Zero-weight practice' });
  await page.reload();
  await nav(page).getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: `Progress for ${exercise.name}` }).click();
  await expect(
    page.getByRole('heading', { name: 'Your first working set starts the story.' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'All-time exercise statistics' })).toHaveCount(0);
  const program = await command('program.save', { name: 'Zero-weight program' });
  await command('template.save', {
    program_id: program.id,
    name: 'Recorded zero',
    exercises: [
      {
        exercise_id: exercise.id,
        sets: [{ type: 'normal', min_reps: 8, max_reps: 12, rest_ms: 0 }],
      },
    ],
  });
  await command('program.select', { id: program.id });
  const ready: State = await (await page.request.get('/api/state')).json();
  let w = await command('workout.start', {
    assignment_id: ready.assignments.find((a) => a.name === 'Recorded zero')!.id,
  });
  const setId = w.exercises[0].sets[0].id;
  w = await command('session.action', {
    workout_id: w.id,
    version: w.version,
    action: 'set.begin',
    id: setId,
  });
  w = await command('session.action', {
    workout_id: w.id,
    version: w.version,
    action: 'set.complete',
    id: setId,
    actual_grams: 0,
    actual_reps: 12,
  });
  await command('session.action', {
    workout_id: w.id,
    version: w.version,
    action: 'workout.complete',
    skipRemaining: true,
  });
  await command('archive', { kind: 'exercise', id: exercise.id });
  await page.reload();
  await nav(page).getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByText('Archived exercises (1)', { exact: true }).click();
  await page.getByRole('button', { name: `Progress for ${exercise.name}` }).click();
  await expect(page.getByRole('combobox', { name: 'Metric', exact: true })).toContainText(
    'Total reps',
  );
  await expect(page.getByRole('region', { name: 'Latest top set' })).toContainText(
    '0 kg × 12 reps',
  );
  await expect(page.getByRole('region', { name: 'All-time exercise statistics' })).toContainText(
    '—kg',
  );
  await expect(page.getByRole('button', { name: 'View 12-rep record: 0 kilograms' })).toBeVisible();
  expect(errors).toEqual([]);
});
