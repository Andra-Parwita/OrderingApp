import { expect, test, type Page } from '@playwright/test';
import { keepAdminPasskey } from './adminSession';
import { collectErrors } from './sellerHelpers';

// Stage 7.3: the real routes. The admin invites Dapur Demo, the seller sets up with the key and a
// password, sees Devices, signs out and in again; then a chef is invited and has no Menu (D-013).
// Desktop only. Runs in its own project after the other sign-in specs (same Dapur Demo account).

const PASSWORD = 'session flow long password';
const CHEF_PASSWORD = 'chef flow long password';

async function setUpWithKey(page: Page, key: string, password: string, device: string) {
  await page.goto('/seller/setup');
  await page.getByLabel('Enter the key you were sent').fill(key);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('button', { name: "My phone can't do this → set a password instead" })
    .click();
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByLabel('Name of this device').fill(device);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/seller$/);
}

test('admin invites, seller sets up and signs in again, chef has no menu', async ({ page }) => {
  const errors = collectErrors(page);

  // Admin: /admin has no session, so it leads to the admin sign-in.
  await keepAdminPasskey(page, 'session-flow-desktop-chromium');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
  await page.getByRole('button', { name: 'Sign in with passkey' }).click();
  await expect(page.getByRole('table', { name: 'Sellers' })).toBeVisible();
  await page.getByRole('row', { name: /Dapur Demo/ }).click();
  await page.getByRole('button', { name: 'Create invite key' }).click();
  const box = page.getByRole('region', { name: 'Invite key for Dapur Demo' });
  const key = ((await box.locator('code').textContent()) ?? '').trim();
  expect(key.length).toBeGreaterThan(8);

  // Seller: the key, then a password; lands in the seller area as Dapur Demo, no picker.
  await setUpWithKey(page, key, PASSWORD, 'E2E session flow');
  await expect(
    page.getByText('Signed in as Dapur Demo').or(page.getByText('Dapur Demo · seller')),
  ).toBeVisible();
  await expect(page.getByLabel('Seller (dev only)')).toHaveCount(0);
  await page.screenshot({ path: 'captures/session-flow-seller.png', fullPage: true });

  // More: Devices lists this device; the seller sees everything.
  await page.getByRole('link', { name: 'More' }).click();
  await expect(page.getByRole('button', { name: 'Week settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Devices' }).click();
  await expect(page.getByText('E2E session flow', { exact: true })).toBeVisible();
  await expect(page.getByText('Active now')).toBeVisible();

  // Chef: made over the API with the seller's session (the page's own cookie, which this spec
  // cannot read), invited, and set up on this device.
  const made = await page.request.post('/api/seller/chefs', {
    data: { name: 'Rudi' },
  });
  expect(made.ok()).toBe(true);
  const { chef } = (await made.json()) as { chef: { id: string } };
  const invited = await page.request.post('/api/seller/chef-invites', {
    data: { chefId: chef.id },
  });
  expect(invited.ok()).toBe(true);
  const chefKey = ((await invited.json()) as { key: string }).key;

  // Sign out of this device (Devices, two taps) leads to the sign-in page.
  await page.getByRole('button', { name: 'Sign out of this device' }).click();
  await page.getByRole('button', { name: 'Tap again to sign out' }).click();
  await expect(page).toHaveURL(/\/seller\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Dapur Demo' })).toBeVisible();
  await page.screenshot({ path: 'captures/session-flow-sign-in.png', fullPage: true });

  await page.getByRole('button', { name: 'Use password instead' }).click();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/seller$/);
  await expect(
    page.getByText('Signed in as Dapur Demo').or(page.getByText('Dapur Demo · seller')),
  ).toBeVisible();

  // More > Sign out, then the chef sets up.
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/seller\/sign-in$/);
  await setUpWithKey(page, chefKey, CHEF_PASSWORD, 'E2E chef flow');
  await expect(
    page.getByText('Signed in as Chef Rudi').or(page.getByText('Rudi · chef')),
  ).toBeVisible();
  const rail = page.getByRole('navigation', { name: 'Seller' });
  await expect(rail.getByRole('link', { name: 'Orders' })).toBeVisible();
  await expect(rail.getByRole('link', { name: 'Hand-over' })).toBeVisible();
  await expect(rail.getByRole('link', { name: 'Menu', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'captures/session-flow-chef.png', fullPage: true });

  // The Saturday hub: three big buttons, each leading to its tool.
  await rail.getByRole('link', { name: 'Hand-over' }).click();
  await expect(page).toHaveURL(/\/seller\/hand-over$/);
  const hub = page.getByRole('navigation', { name: 'Saturday' });
  await expect(hub.getByRole('link')).toHaveCount(3);
  await page.screenshot({ path: 'captures/session-flow-hub.png', fullPage: true });
  await hub.getByRole('link', { name: 'Send an update' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Send an update' })).toBeVisible();

  await page.goto('/seller/menu');
  await expect(page.getByRole('heading', { name: 'Not available for chefs' })).toBeVisible();
  await page.getByRole('link', { name: 'More' }).click();
  await expect(page.getByRole('button', { name: 'Devices' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Labels' })).toBeVisible();
  for (const hidden of ['Week settings', 'Pictures', 'Chefs', 'Backup', 'Settings']) {
    await expect(page.getByRole('button', { name: hidden, exact: true })).toHaveCount(0);
  }

  expect(errors).toEqual([]);
});
