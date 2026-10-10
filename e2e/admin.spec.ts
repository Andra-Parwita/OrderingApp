import { expect, test } from '@playwright/test';
import { DEV_ADMIN_SETUP_KEY, keepAdminPasskey } from './adminSession';
import { collectErrors } from './sellerHelpers';

// Admin setup screen, sign-in, a new seller and an invite key, through the dev harness. The admin
// is made once per run by global-setup.ts, so setup is refused and this spec signs in with the
// passkey that setup left for it: a real WebAuthn credential, held by Chrome's virtual
// authenticator, checked by the server. It adds its own seller with a unique link.

test('admin sets up or signs in, adds a seller and sees an invite key once', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop only');
  const errors = collectErrors(page);
  await keepAdminPasskey(page, 'admin-desktop-chromium');

  await page.goto('/?harness=admin&screen=setup');
  await expect(page.getByRole('heading', { level: 1, name: 'Set up the admin' })).toBeVisible();
  await expect(page.getByText('This page stops working once an admin exists.')).toBeVisible();
  await page.screenshot({
    path: `captures/admin-setup-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.getByLabel('Setup key').fill(DEV_ADMIN_SETUP_KEY);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByText('An admin is already set up, so this page no longer works.'),
  ).toBeVisible();

  await page.goto('/?harness=admin&screen=signin');
  await page.screenshot({
    path: `captures/admin-signin-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Sign in with passkey' }).click();

  await expect(page.getByRole('table', { name: 'Sellers' })).toBeVisible();
  await expect(page.getByText(/shows no orders, customers or menus/)).toBeVisible();

  // A reserved link says why, then a unique one adds the seller.
  const slug = `warung-${Date.now().toString(36)}`;
  await page.getByLabel('Seller name').fill('Warung Test');
  await page.getByLabel('Customer link').fill('admin');
  await expect(page.getByText('That link is reserved by the app. Pick another.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add seller' })).toBeDisabled();
  await page.getByLabel('Customer link').fill(slug);
  await page.getByRole('button', { name: 'Add seller' }).click();
  await expect(page.getByText(`Warung Test was added. The link is /${slug}.`)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`/${slug}`) })).toBeVisible();

  // The Created column shows a date, and the new seller has no chefs (read-only section).
  await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chefs' })).toBeVisible();
  await expect(page.getByText('No chefs yet.')).toBeVisible();

  // The new seller is selected: an invite key is shown once.
  await page.getByRole('button', { name: 'Create invite key' }).click();
  const box = page.getByRole('region', { name: 'Invite key for Warung Test' });
  await expect(box).toBeVisible();
  await expect(box.getByText('Valid for 24 hours, works on up to 3 devices.')).toBeVisible();
  const key = (await box.locator('code').textContent()) ?? '';
  expect(key.length).toBeGreaterThan(8);
  await expect(box.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/\?text=/,
  );
  await page.screenshot({
    path: `captures/admin-home-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await box.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText(key)).toHaveCount(0);

  // The refused setup (409) is the point of the first step; the browser logs it.
  expect(errors.filter((error) => !error.includes('status of 409'))).toEqual([]);
});
