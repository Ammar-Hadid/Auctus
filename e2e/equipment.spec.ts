import { test, expect } from '@playwright/test';

test('equipment is required, editable and clearly shown in the library and search', async ({
  page,
}, info) => {
  await page.goto('/login/account');
  await page.getByLabel('Email', { exact: true }).fill('alarm@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-only-alarm-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const nav = page.getByRole('navigation', {
    name: page.viewportSize()!.width < 760 ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
  await nav.getByRole('button', { name: 'Library', exact: true }).click();
  const labels = ['Dumbbells', 'Stack machine', 'Plate-loaded machine', 'Cable machine', 'Other'];
  for (const [i, label] of labels.entries()) {
    await page.getByRole('button', { name: 'New exercise', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(`Equipment example ${i}`);
    if (i === 0) {
      await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'New exercise', exact: true })).toBeVisible();
    }
    await page.getByRole('combobox', { name: 'Equipment', exact: true }).click();
    await expect(page.getByRole('option')).toHaveText(labels);
    if (i === 0)
      await page.screenshot({
        path: info.outputPath('equipment-menu.png'),
        fullPage: false,
        animations: 'disabled',
      });
    await page.getByRole('option', { name: label, exact: true }).click();
    await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
    const row = page
      .locator('.list-row')
      .filter({ has: page.getByRole('heading', { name: `Equipment example ${i}`, exact: true }) });
    await expect(row.locator('.equipment-label')).toHaveText(label);
  }
  const row = page
    .locator('.list-row')
    .filter({ has: page.getByRole('heading', { name: 'Equipment example 0', exact: true }) });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Equipment', exact: true })).toContainText(
    'Dumbbells',
  );
  await page.getByRole('combobox', { name: 'Equipment', exact: true }).click();
  await page.getByRole('option', { name: 'Cable machine', exact: true }).click();
  await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
  await expect(row.locator('.equipment-label')).toHaveText('Cable machine');
  await page.reload();
  await nav.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(row.locator('.equipment-label')).toHaveText('Cable machine');
  const search = page.getByRole('combobox', { name: 'Search exercises', exact: true });
  await search.fill('Cable machine');
  await expect(
    page.getByRole('option', { name: 'Equipment example 0', exact: true }),
  ).toContainText('Cable machine');
  await expect(
    page.getByRole('option', { name: 'Equipment example 3', exact: true }),
  ).toContainText('Cable machine');
  await search.press('Escape');
  await expect(page.locator('.list-row')).toHaveCount(2);
  await search.fill('');
  await search.press('Escape');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`equipment-library-${width}.png`),
      fullPage: true,
    });
  }
});
