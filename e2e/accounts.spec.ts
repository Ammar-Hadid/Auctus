import { test, expect } from '@playwright/test';
test('master password plus passkey, master-only provisioning, and isolated members', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'WebAuthn virtual authenticator is available through Chromium CDP.',
  );
  const origin = 'http://localhost:3100';
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const originalAuthenticator = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  async function login() {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('master@example.test');
    await page.getByLabel('Password', { exact: true }).fill('test-only-master-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/unlock');
  }
  await login();
  for (const path of ['/api/state', '/api/accounts', '/api/push'])
    expect((await page.request.get(path)).status()).toBe(403);
  expect(
    (await page.request.post('/api/command', { headers: { origin }, data: {} })).status(),
  ).toBe(403);
  await expect(page.getByRole('button', { name: 'Create passkey', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/passkey-setup.png', fullPage: true });
  await page.getByRole('button', { name: 'Create passkey', exact: true }).click();
  await page.waitForURL(origin + '/');
  const owner = (await (await page.request.get('/api/state')).json()).account;
  expect(owner.role).toBe('master');
  const ownerWrite = await page.request.post('/api/command', {
    headers: { origin, 'x-auctus-account': owner.id },
    data: {
      requestId: crypto.randomUUID(),
      action: 'exercise.save',
      data: { name: 'Master private exercise' },
    },
  });
  expect(ownerWrite.status()).toBe(200);
  const privateExercise = (await ownerWrite.json()).result;
  await page.getByRole('button', { name: 'Account settings', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Security test');
  await page.getByLabel('Email', { exact: true }).fill('security@example.test');
  await page.getByLabel('New account password', { exact: true }).fill('long-test-account-password');
  await page.getByLabel('Your master password', { exact: true }).fill('wrong-master-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(
    page.getByText('Your current password is incorrect.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.getByLabel('Your master password', { exact: true }).fill('test-only-master-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.locator('.toast.success')).toContainText('Account created');
  await page.screenshot({ path: 'test-results/master-accounts.png', fullPage: true });
  const other = await page.context().browser()!.newContext({ baseURL: origin });
  try {
    expect(
      (
        await other.request.post('/api/auth/sign-in/email', {
          headers: { origin },
          data: { email: 'security@example.test', password: 'long-test-account-password' },
        })
      ).status(),
    ).toBe(200);
    const state = await (await other.request.get('/api/state')).json();
    expect(state.account.role).toBe('member');
    expect(state.exercises).toEqual([]);
    expect(state.programs).toEqual([]);
    expect((await other.request.get('/api/accounts')).status()).toBe(403);
    expect(
      (await other.request.post('/api/accounts', { headers: { origin }, data: {} })).status(),
    ).toBe(403);
    expect(
      (
        await other.request.post('/api/passkeys', {
          headers: { origin },
          data: { kind: 'register', action: 'options' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await other.request.post('/api/command', {
          headers: { origin, 'x-auctus-account': state.account.id },
          data: {
            requestId: crypto.randomUUID(),
            action: 'exercise.save',
            data: { id: privateExercise.id, name: 'Attack' },
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await other.request.post('/api/command', {
          headers: { origin, 'x-auctus-account': owner.id },
          data: {
            requestId: crypto.randomUUID(),
            action: 'exercise.save',
            data: { name: 'Stale account' },
          },
        })
      ).status(),
    ).toBe(409);
    const memberPage = await other.newPage();
    await memberPage.goto('/');
    await memberPage.getByRole('button', { name: 'Account settings', exact: true }).click();
    await expect(memberPage.getByRole('heading', { name: 'Manage accounts' })).toHaveCount(0);
    await memberPage.screenshot({ path: 'test-results/member-settings.png', fullPage: true });
  } finally {
    await other.close();
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/login');
  await login();
  expect(
    (
      await page.request.post('/api/passkeys', {
        headers: { origin },
        data: { kind: 'register', action: 'options' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post('/api/passkeys', {
        headers: { origin: 'https://evil.example' },
        data: { kind: 'authenticate', action: 'options' },
      })
    ).status(),
  ).toBe(403);
  const options = await page.request.post('/api/passkeys', {
    headers: { origin },
    data: { kind: 'authenticate', action: 'options' },
  });
  expect(options.status()).toBe(200);
  expect(await options.json()).toMatchObject({
    allowCredentials: [],
    userVerification: 'required',
  });
  expect(
    (
      await page.request.post('/api/passkeys', {
        headers: { origin },
        data: { kind: 'authenticate', action: 'verify', response: { id: 'fake' } },
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.get('/api/state')).status()).toBe(403);
  await page.getByRole('button', { name: 'Verify passkey', exact: true }).click();
  await page.waitForURL(origin + '/');
  expect((await page.request.get('/api/state')).status()).toBe(200);

  // An already-verified session can enroll another provider when the first
  // authenticator is unavailable, without deleting the original server key.
  await cdp.send('WebAuthn.removeVirtualAuthenticator', originalAuthenticator);
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.goto('/unlock?add=1');
  await page.getByRole('button', { name: 'Create passkey', exact: true }).click();
  await page.waitForURL(origin + '/');
  const backupOptions = await page.request.post('/api/passkeys', {
    headers: { origin },
    data: { kind: 'register', action: 'options' },
  });
  expect(backupOptions.status()).toBe(200);
  expect((await backupOptions.json()).excludeCredentials).toHaveLength(2);
  await page.request.post('/api/auth/sign-out', { headers: { origin }, data: {} });
  await login();
  expect((await page.request.get('/api/state')).status()).toBe(403);
  await page.getByRole('button', { name: 'Verify passkey', exact: true }).click();
  await page.waitForURL(origin + '/');
  expect((await page.request.get('/api/state')).status()).toBe(200);
});
