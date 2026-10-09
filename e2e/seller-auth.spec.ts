import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { adminSignIn, originHeaders, type AdminLabel } from './adminSession';
import { collectErrors } from './sellerHelpers';
import { credentialsOf, virtualAuthenticator } from './virtualAuthenticator';

// Stage 7.2a: sign-in screens through the harness. Runs on the Android phone and the desktop only,
// in the "auth" projects (one at a time). The admin comes from global-setup.ts, with its own
// passkey per project. Device names are unique per project. Stage 8.2: passkeys are real WebAuthn,
// made and used in Chrome's virtual authenticator; the password path stays covered.

test.skip(({ browserName }) => browserName !== 'chromium', 'Android (Chromium) and desktop only');
// Both tests use the same admin device and Dapur Demo's account: one after the other.
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'e2e long enough password';

/** An invite key for Dapur Demo, made by this project's admin device (signed in by passkey). */
async function inviteKeyFor(request: APIRequestContext, project: string): Promise<string> {
  const kind = project.includes('desktop') ? 'desktop-chromium' : 'mobile-chromium';
  await adminSignIn(request, `seller-auth-${kind}` as AdminLabel);
  const sellers = await request.get('/api/admin/sellers');
  const list = (await sellers.json()) as { sellers: Array<{ id: string; slug: string }> };
  const seller = list.sellers.find((candidate) => candidate.slug === 'dapur-demo');
  if (!seller) throw new Error('Dapur Demo is not in the mock');
  const invite = await request.post(`/api/admin/sellers/${seller.id}/invite-key`, {
    headers: originHeaders,
  });
  expect(invite.ok()).toBe(true);
  return ((await invite.json()) as { key: string }).key;
}

const capture = (page: Page, name: string, project: string) =>
  page.screenshot({ path: `captures/seller-auth-${name}-${project}.png`, fullPage: true });

test('a real passkey: create it, sign out, sign back in with it', async ({
  page,
  request,
}, testInfo) => {
  const errors = collectErrors(page);
  const project = testInfo.project.name;
  const deviceName = `E2E passkey ${project}`;
  const key = await inviteKeyFor(request, project);
  const authenticator = await virtualAuthenticator(page);

  await page.goto('/?harness=seller-auth&screen=key');
  await page.getByLabel('Enter the key you were sent').fill(key);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Create a passkey' })).toBeVisible();
  // The prototype note is gone: the passkey is real now.
  await expect(page.getByText(/simulated/i)).toHaveCount(0);
  await page.getByLabel('Name of this device').fill(deviceName);
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(page.getByText(deviceName, { exact: true })).toBeVisible();

  // The authenticator really holds a passkey for this site, and the page kept only its id.
  const made = await credentialsOf(authenticator);
  expect(made).toHaveLength(1);
  expect(made[0]?.rpId).toBe('localhost');
  const stored = await page.evaluate(() => ({
    credential: localStorage.getItem('passkeyCredential'),
    session: localStorage.getItem('session'),
  }));
  expect(stored.session).toBeNull();
  expect(stored.credential).toBe(
    Buffer.from(made[0]?.credentialId ?? '', 'base64').toString('base64url'),
  );
  // The session is an HttpOnly cookie: script cannot see it, the browser has it.
  expect(await page.evaluate(() => document.cookie)).not.toContain('__Host-session');
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === '__Host-session');
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' });

  await page.getByRole('button', { name: 'Sign out of this device' }).click();
  await page.getByRole('button', { name: 'Tap again to sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Dapur Demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(page.getByText('Active now')).toBeVisible();
  // The signature counter went up on the authenticator (a replay would be refused).
  const used = await credentialsOf(authenticator);
  expect(used[0]?.signCount).toBeGreaterThan(made[0]?.signCount ?? 0);

  expect(errors).toEqual([]);
});

test('key, password, devices and add-device code, then sign out and back in', async ({
  page,
  request,
}, testInfo) => {
  const errors = collectErrors(page);
  const project = testInfo.project.name;
  const deviceName = `E2E ${project}`;
  const key = await inviteKeyFor(request, project);

  await page.goto('/?harness=seller-auth&screen=key');
  await expect(page.getByRole('heading', { name: 'Set up your sign-in' })).toBeVisible();
  await capture(page, 'key', project);

  // A key typed in small letters, with spaces, is accepted.
  await page.getByLabel('Enter the key you were sent').fill(key.toLowerCase().replaceAll('-', ' '));
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Create a passkey' })).toBeVisible();
  await expect(page.getByText(/simulated/i)).toHaveCount(0);
  await capture(page, 'passkey', project);

  await page
    .getByRole('button', { name: "My phone can't do this → set a password instead" })
    .click();
  await expect(page.getByRole('heading', { name: 'Set a password' })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Name of this device').fill(deviceName);
  await capture(page, 'password', project);
  await page.getByRole('button', { name: 'Save password' }).click();

  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(page.getByText(deviceName, { exact: true })).toBeVisible();
  await expect(page.getByText('Active now')).toBeVisible();

  await page.getByRole('button', { name: 'Add a device' }).click();
  await expect(page.getByLabel('Your code')).toHaveText(/^\d{6}$/);
  await expect(page.getByText(/^Expires in \d\d:\d\d$/)).toBeVisible();
  await capture(page, 'devices', project);

  // Sign out of this device (two taps), then back in with the password.
  await page.getByRole('button', { name: 'Sign out of this device' }).click();
  await page.getByRole('button', { name: 'Tap again to sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Dapur Demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Use password instead' }).click();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await capture(page, 'signin', project);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(page.getByText('Active now')).toBeVisible();

  expect(errors).toEqual([]);
});
