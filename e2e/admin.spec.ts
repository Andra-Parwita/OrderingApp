import { expect, test } from '@playwright/test';
import { DEV_ADMIN_SETUP_KEY, keepAdminPasskey } from './adminSession';
import { collectErrors } from './sellerHelpers';

// Admin setup screen, sign-in, a new seller and an invite key, through the dev harness. The admin
// is made once per run by global-setup.ts, so setup is refused and this spec signs in with the
// passkey that setup left for it: a real WebAuthn credential, held by Chrome's virtual
// authenticator, checked by the server. It adds its own seller with a unique link.

test.describe.configure({ mode: 'serial' });

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

  await expect(page.getByRole('list', { name: 'Sellers' })).toBeVisible();
  await expect(page.getByText(/^Last updated \d\d:\d\d/)).toBeVisible();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Refresh in \d+ s$/ })).toBeDisabled();

  // The harness has no brand bar or pictures editor: carry on in the real admin route, which
  // the sign-in just opened a session for.
  await page.goto('/admin');
  await expect(page.getByRole('list', { name: 'Sellers' })).toBeVisible();
  await expect(page.getByText(/shows no orders or customers/)).toBeVisible();

  // A reserved link says why, then a unique one adds the seller.
  const slug = `warung-${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Add a seller' }).click();
  await page.getByLabel('Seller name').fill('Warung Test');
  await page.getByLabel('Customer link').fill('admin');
  await expect(page.getByText('That link is reserved by the app. Pick another.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add seller' })).toBeDisabled();
  await page.getByLabel('Customer link').fill(slug);
  await page.getByRole('button', { name: 'Add seller' }).click();
  await expect(page.getByText(`Warung Test was added. The link is /${slug}.`)).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`/${slug}`) })).toBeVisible();

  // The row shows the created date, and the new seller (opened by adding it) has nobody yet.
  await expect(page.getByRole('button', { name: /Created/ }).last()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  await expect(page.getByText('Nobody has joined yet.')).toBeVisible();

  // The new seller is open: an invite for a named person, key shown once.
  await page.getByRole('button', { name: 'Create invite key' }).click();
  const box = page.getByRole('region', { name: 'Invite key for Warung Test' });
  await box.getByLabel('Name of the person').fill('Bu Warung');
  await box.getByRole('button', { name: 'Create invite' }).click();
  await expect(
    box.getByText('Works once, on one device, within 24 hours.', { exact: true }),
  ).toBeVisible();
  await expect(box.getByRole('button', { name: 'Copy link with key' })).toBeVisible();
  const key = (await box.locator('code').textContent()) ?? '';
  expect(key.length).toBeGreaterThan(8);
  await expect(box.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/api\.whatsapp\.com\/send\?text=/,
  );
  await page.screenshot({
    path: `captures/admin-home-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await box.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText(key)).toHaveCount(0);

  // Plan 038 stage 4: the panel's two tabs and the brand bar in dark mode, at desktop size.
  await page.setViewportSize({ width: 1361, height: 865 });
  const panel = page.getByRole('dialog', { name: 'Warung Test' });
  await expect(panel.getByRole('tab', { name: 'Invitations' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({ path: 'captures/p038/panel-invitations.png' });
  await panel.getByRole('tab', { name: 'Settings' }).click();
  await expect(panel.getByRole('checkbox', { name: 'Demo kitchen' })).toBeVisible();
  await expect(
    panel.getByRole('heading', { name: 'Wide banner (tablet and computer)' }),
  ).toBeVisible();
  await page.screenshot({ path: 'captures/p038/panel-settings.png' });
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({
    path: 'captures/p038/bar-dark.png',
    clip: { x: 0, y: 0, width: 1361, height: 120 },
  });

  // The refused setup (409) is the point of the first step; the browser logs it.
  expect(errors.filter((error) => !error.includes('status of 409'))).toEqual([]);
});

// Plan 032 stage 4: the admin closes a kitchen to customers and resumes it. A fresh kitchen the
// spec adds, so the sample kitchens are never paused.
test('admin closes a new kitchen to customers, sees the state, and resumes it', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop only');
  await keepAdminPasskey(page, 'admin-desktop-chromium');
  await page.goto('/?harness=admin&screen=signin');
  await page.getByRole('button', { name: 'Sign in with passkey' }).click();
  await expect(page.getByRole('list', { name: 'Sellers' })).toBeVisible();
  await page.goto('/admin');

  const slug = `pause-${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Add a seller' }).click();
  await page.getByLabel('Seller name').fill('Pause Test');
  await page.getByLabel('Customer link').fill(slug);
  await page.getByRole('button', { name: 'Add seller' }).click();
  const panel = page.getByRole('dialog', { name: 'Pause Test' });
  await expect(panel).toBeVisible();
  // The new row has its summary line at once, without a reload.
  const row = page.getByRole('button', { name: new RegExp(`/${slug}`) });
  await expect(row).toContainText('0 people');

  await panel.getByRole('tab', { name: 'Settings' }).click();
  await expect(panel.getByText('Open', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Close to customers' }).click();
  await expect(panel.getByText('Closed to customers')).toBeVisible();
  await expect(row).toContainText('Closed to customers');

  await panel.getByRole('button', { name: 'Resume the kitchen' }).click();
  await expect(panel.getByText('Open', { exact: true })).toBeVisible();
  await expect(row).not.toContainText('Closed to customers');
  await expect(panel.getByRole('button', { name: 'Resume the kitchen' })).toHaveCount(0);
});
