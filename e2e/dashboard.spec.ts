import { test, expect } from '@playwright/test';
import type { State } from '../src/domain/types';
import { attendanceWeek, formatNumber, strengthTrend } from '../src/domain/dashboard';

test('dashboard explains real training data, supports drill-down and fits every screen', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const entered = await page.request.post('/api/showcase', {
    headers: { origin: 'http://localhost:3100' },
    data: { action: 'enter', code: 'test-only-showcase-code' },
  });
  expect(entered.ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make today count.' })).toBeVisible();
  const state: State = await (await page.request.get('/api/state')).json();
  const totals = page.getByRole('region', { name: 'This week so far' });
  await expect(totals).toContainText(formatNumber(state.current.volume));
  await totals.getByText('How these numbers work', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(totals.getByText(/Training time includes rest/)).toBeVisible();
  await totals.getByText('How these numbers work', { exact: true }).click();
  const calendar = page.getByRole('region', { name: 'Your weekly schedule' });
  await calendar.getByRole('button', { name: 'Previous attendance week' }).click();
  const priorDays = attendanceWeek(state.history, state.serverNow, -1);
  for (const day of priorDays.filter((d) => d.workouts.length)) {
    const button = calendar.getByRole('button', {
      name: new RegExp(`^${day.label} .*completed workout`),
    });
    await expect(button.locator('s')).toHaveText(String(day.day));
    await button.click();
    await expect(calendar.getByRole('button', { name: day.workouts[0].name })).toBeVisible();
  }
  await calendar.getByRole('button', { name: 'Next attendance week' }).click();
  await expect(calendar.getByRole('button', { name: 'Next attendance week' })).toBeDisabled();
  const activity = page.getByRole('region', { name: 'Training over time' });
  await activity.getByRole('button', { name: 'Volume', exact: true }).click();
  await expect(activity.getByRole('button', { name: 'Volume', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await activity.getByText('View chart data', { exact: true }).click();
  await expect(activity.getByRole('table')).toContainText(formatNumber(state.current.volume));
  await activity.getByText('View chart data', { exact: true }).click();
  await activity.getByRole('button', { name: 'Workouts', exact: true }).click();
  const strength = page.getByRole('region', { name: 'What you’re lifting' });
  const eligible = state.exercises.filter((e) => strengthTrend(state.history, e.id).length);
  await strength.getByRole('combobox').click();
  await page.getByRole('option', { name: eligible.at(-1)!.name, exact: true }).click();
  const point = strengthTrend(state.history, eligible.at(-1)!.id).at(-1)!;
  await expect(strength).toContainText(`${formatNumber(point.kg)} kg × ${point.reps} reps`);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(calendar).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`dashboard-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
  await strength.getByRole('button', { name: 'Exercise history' }).click();
  await expect(
    page.getByRole('heading', { name: eligible.at(-1)!.name, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name: 'Overview' })
    .click();
  const latest = state.history
    .filter((w) => w.status === 'completed')
    .sort((a, b) => b.started_at - a.started_at)[0];
  await page
    .getByRole('region', { name: 'Recent sessions' })
    .getByRole('button')
    .filter({ hasText: latest.name })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: latest.name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit workout', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('new account has honest empty states and a clear first action', async ({ page }) => {
  await page.goto('/login/account');
  await page.getByLabel('Email', { exact: true }).fill('alarm@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-only-alarm-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Build your program' })).toBeVisible();
  await expect(page.getByText('Your consistency starts here.')).toBeVisible();
  await expect(page.getByText('A starting point awaits.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your weekly schedule' }).locator('s')).toHaveCount(
    0,
  );
  await expect(page.getByRole('region', { name: 'Recent sessions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Build your program' }).click();
  await expect(page.getByRole('button', { name: 'New program', exact: true })).toBeVisible();
});
