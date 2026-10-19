import { test, expect } from '@playwright/test';

test('sign-in errors stay fixed, expire automatically and return on another attempt', async ({ page }) => {
  await page.route('**/api/auth/sign-in/email', (route) =>
    route.fulfill({ status: 401, json: { error: 'Invalid credentials' } }),
  );
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('wrong@example.test');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  const form = page.locator('form');
  const before = await form.boundingBox();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const toast = page.locator('.toast.error');
  await expect(toast).toContainText('Sign-in failed');
  await expect(page.locator('.toast-viewport')).toHaveCSS('position', 'fixed');
  expect((await form.boundingBox())!.height).toBe(before!.height);
  const initial = await toast.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect((await toast.boundingBox())!.y).toBeCloseTo(initial!.y, 0);
  await page.mouse.move(0, 0);
  await expect(toast).toHaveCount(0, { timeout: 7500 });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(toast).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(toast).toHaveCount(0);
});

test('dialog errors and unconfirmed saves share a fixed, keyboard-accessible stack', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const origin = 'http://localhost:3100';
  expect(
    (
      await page.request.post('/api/auth/sign-in/email', {
        headers: { origin },
        data: { email: 'alarm@example.test', password: 'test-only-alarm-password' },
      })
    ).status(),
  ).toBe(200);
  await page.goto('/');
  const nav = page.getByRole('navigation', {
    name: page.viewportSize()!.width < 760 ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
  await nav.getByRole('button', { name: 'Library', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Search exercises', exact: true })
    .fill('Toast check ' + testInfo.project.name);
  await page
    .getByRole('option', { name: `Add “Toast check ${testInfo.project.name}”`, exact: true })
    .click();
  await page
    .getByLabel('Exercise name', { exact: true })
    .fill('Toast check ' + testInfo.project.name);
  const panel = page.locator('.exercise-dialog');
  const before = await panel.boundingBox();
  let failure = 400;
  await page.route('**/api/command', (route) =>
    failure
      ? route.fulfill({
          status: failure,
          json: { error: 'Could not save this exercise. Your details are kept.' },
        })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
  const toast = page.locator('.toast.error');
  await expect(toast).toBeVisible();
  expect((await panel.boundingBox())!.height).toBe(before!.height);
  await expect(page.getByRole('dialog').locator('.toast-viewport')).toHaveCSS('position', 'fixed');
  const dismiss = page.getByRole('button', { name: 'Dismiss notification' });
  await dismiss.focus();
  await expect(dismiss).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toast).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  failure = 500;
  await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
  await expect(page.locator('.toast')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const viewport = (await page.locator('.toast-viewport').boundingBox())!;
    expect(viewport.x).toBeGreaterThanOrEqual(0);
    expect(viewport.x + viewport.width).toBeLessThanOrEqual(width);
    if (width < 760) {
      const mobileNav = (await page.locator('.mobile-nav').boundingBox())!;
      expect(viewport.y + viewport.height).toBeLessThanOrEqual(mobileNav.y);
    }
    await page.screenshot({ path: testInfo.outputPath(`toasts-${width}.png`), fullPage: true });
  }
  failure = 0;
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close create exercise', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Toast check ' + testInfo.project.name, exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
