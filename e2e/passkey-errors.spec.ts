import { test, expect } from '@playwright/test';

test('device cancellation stays locked, explains the stage, and allows a fresh attempt', async ({
  page,
}) => {
  let attempts = 0;
  let verifications = 0;
  await page.route('**/api/passkeys', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { enrolled: true } });
      return;
    }
    const body = route.request().postDataJSON();
    if (body.action === 'verify') verifications++;
    else attempts++;
    await route.fulfill({
      json: {
        challenge: Buffer.from(`test-challenge-${attempts}`).toString('base64url'),
        rpId: 'localhost',
        allowCredentials: [],
        userVerification: 'required',
      },
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.credentials, 'get', {
      value: async () => {
        throw new DOMException('Unable to sign in using passkey', 'NotAllowedError');
      },
    });
  });
  await page.goto('/unlock');
  const verify = page.getByRole('button', { name: 'Verify passkey', exact: true });
  await verify.click();
  await expect(page.locator('.toast.error')).toContainText(
    'Your device did not return a passkey',
  );
  await expect(page.locator('.toast.error')).toContainText('Device: NotAllowedError');
  await expect(verify).toBeEnabled();
  await expect(page).toHaveURL(/\/unlock$/);
  expect(verifications).toBe(0);
  expect(attempts).toBe(1);
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await verify.click();
  await expect(verify).toBeEnabled();
  await expect.poll(() => attempts).toBe(2);
  expect(verifications).toBe(0);
});
