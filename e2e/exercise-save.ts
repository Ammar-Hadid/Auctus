import { expect, test, type Page } from '@playwright/test';

export async function verifyExerciseSave(page: Page, programName: string) {
  const save = page.getByRole('button', {
    name: 'Save Incline dumbbell press and collapse',
    exact: true,
  });
  const edit = page.getByRole('button', { name: 'Edit Incline dumbbell press', exact: true });
  await expect(save).toBeVisible();
  // Safari on iPhone does not tab-focus buttons; check keyboard styling on desktop.
  if (!test.info().project.use.isMobile) {
    await save.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(save).toBeFocused();
    expect(await save.evaluate((el) => getComputedStyle(el).outlineOffset)).toBe('-2px');
  }
  await page.getByLabel('Workout name').fill('');
  await save.click();
  await expect(page.getByLabel('Workout name')).toBeFocused();
  await expect(page.getByLabel('Set 1 minimum reps')).toBeVisible();
  await page.getByLabel('Workout name').fill('Upper body strength');
  await page.getByLabel('Set 1 minimum reps').fill('6');
  await page.getByLabel('Set 1 maximum reps').fill('8');
  await page.route(
    '**/api/command',
    (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Test save rejected. Your edits are kept.' }),
      }),
    { times: 1 },
  );
  await save.click();
  await expect(
    page.getByText('Test save rejected. Your edits are kept.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('Set 1 minimum reps')).toHaveValue('6');
  await page.screenshot({
    path: `test-results/exercise-expanded-${test.info().project.name}.png`,
    fullPage: true,
  });
  await save.click();
  await expect(edit).toBeVisible();
  await expect(page.getByLabel('Set 1 minimum reps')).toHaveCount(0);
  const state = await (await page.request.get('/api/state')).json();
  const programId = state.programs.find((p: { name: string }) => p.name === programName).id;
  const template = state.templates.find(
    (t: { name: string; program_id: string }) =>
      t.name === 'Upper body strength' && t.program_id === programId,
  );
  expect(template.exercises[0].sets[0]).toMatchObject({
    min_reps: 6,
    max_reps: 8,
    type: 'failure',
  });
  await edit.click();
  await expect(page.getByLabel('Set 1 minimum reps')).toHaveValue('6');
  await page.getByLabel('Set 1 maximum reps').fill('10');
  // A committed save with a lost response must collapse only after Retry confirms it.
  await page.route(
    '**/api/command',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await save.click();
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible();
  await expect(page.getByLabel('Set 1 maximum reps')).toHaveValue('10');
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(edit).toBeVisible();
  await expect(page.getByLabel('Set 1 maximum reps')).toHaveCount(0);
  const recovered = await (await page.request.get('/api/state')).json();
  const saved = recovered.templates.find((t: { id: string }) => t.id === template.id);
  expect(saved.version).toBe(template.version + 1);
  expect(saved.exercises[0].sets[0]).toMatchObject({
    id: template.exercises[0].sets[0].id,
    max_reps: 10,
  });
  expect(
    recovered.templates.filter(
      (t: { name: string; program_id: string }) =>
        t.name === 'Upper body strength' && t.program_id === programId,
    ),
  ).toHaveLength(1);
  // Adding and reordering another exercise must not move the collapsed state to the wrong row.
  const picker = page.getByRole('combobox', { name: 'Add exercise', exact: true });
  await picker.click();
  await page.getByRole('option', { name: 'Incline dumbbell press', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  const added = page.getByRole('region', {
    name: 'Exercise 2: Incline dumbbell press',
    exact: true,
  });
  await added.getByLabel('Set 1 minimum reps').fill('12');
  await added.getByLabel('Set 1 maximum reps').fill('15');
  await added.getByRole('button', { name: 'Move exercise up', exact: true }).click();
  const first = page.getByRole('region', {
    name: 'Exercise 1: Incline dumbbell press',
    exact: true,
  });
  const second = page.getByRole('region', {
    name: 'Exercise 2: Incline dumbbell press',
    exact: true,
  });
  await expect(first.getByLabel('Set 1 minimum reps')).toHaveValue('12');
  await expect(second.getByLabel('Set 1 minimum reps')).toHaveCount(0);
  await first
    .getByRole('button', { name: 'Save Incline dumbbell press and collapse', exact: true })
    .click();
  await expect(
    first.getByRole('button', { name: 'Edit Incline dumbbell press', exact: true }),
  ).toBeVisible();
  const ordered = await (await page.request.get('/api/state')).json();
  expect(
    ordered.templates
      .find((t: { id: string }) => t.id === template.id)
      .exercises.map((e: { sets: { min_reps: number }[] }) => e.sets[0].min_reps),
  ).toEqual([12, 6]);
  await first.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  await edit.click();
  await save.click();
  await expect(edit).toBeVisible();
  // A fresh page must reopen the saved workout compactly with its persisted values.
  await page.reload();
  const nav = page.getByRole('navigation', {
    name: page.viewportSize()!.width < 760 ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
  await nav.getByRole('button', { name: 'Programs', exact: true }).click();
  await page
    .getByRole('heading', { name: programName, exact: true })
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Open program', exact: true })
    .click();
  await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
  await expect(edit).toBeVisible();
  await expect(page.getByLabel('Set 1 minimum reps')).toHaveCount(0);
  await edit.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Set 1 maximum reps')).toHaveValue('10');
  await save.click();
  await expect(edit).toBeVisible();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
}
