import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { adminToken, type AdminLabel } from './adminSession';
import { collectErrors } from './sellerHelpers';

// Stage 7.2a: sign-in screens through the harness. Runs on the Android phone and the desktop only,
// in the "auth" projects (one at a time). The admin comes from global-setup.ts, with its own
// passkey per project. Device names are unique per project.

test.skip(({ browserName }) => browserName !== 'chromium', 'Android (Chromium) and desktop only');

const PASSWORD = 'e2e long enough password';

const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

/** An invite key for Dapur Demo, made by this project's admin device. */
async function inviteKeyFor(request: APIRequestContext, project: string): Promise<string> {
  const kind = project.includes('desktop') ? 'desktop-chromium' : 'mobile-chromium';
  const token = await adminToken(request, `seller-auth-${kind}` as AdminLabel);
  const sellers = await request.get('/api/admin/sellers', bearer(token));
  const list = (await sellers.json()) as { sellers: Array<{ id: string; slug: string }> };
  const seller = list.sellers.find((candidate) => candidate.slug === 'dapur-demo');
  if (!seller) throw new Error('Dapur Demo is not in the mock');
  const invite = await request.post(`/api/admin/sellers/${seller.id}/invite-key`, bearer(token));
  expect(invite.ok()).toBe(true);
  return ((await invite.json()) as { key: string }).key;
}

const capture = (page: Page, name: string, project: string) =>
  page.screenshot({ path: `captures/seller-auth-${name}-${project}.png`, fullPage: true });

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
  await expect(page.getByText('Prototype: passkey is simulated')).toBeVisible();
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
