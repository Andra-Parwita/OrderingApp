import { expect, test } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';
import { collectErrors } from './sellerHelpers';

// Plan 112: the seller's "Notify customers" bell and the customer's "New menus from <kitchen>" row.
// Nothing is sent and no push permission is asked: the windows are opened and closed again.
test.use({ viewport: { width: 390, height: 844 } });

test('the seller opens and cancels the Notify customers window', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'phone only');
  const status = await request.get('/api/seller/menu-notices');
  expect(status.ok()).toBe(true);
  const { canSend, sends } = (await status.json()) as { canSend: boolean; sends: Array<unknown> };
  test.skip(!canSend, 'the sample menu is not taking orders');
  const errors = collectErrors(page);

  await page.goto('/seller/orders'); // a phone has no Home or Menu: the bell sits in the Orders header
  await page.getByRole('button', { name: /Notify customers/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Notify customers?' });
  await expect(sheet).toBeVisible();
  // A fresh store says "Not sent yet"; after a send in an earlier run it says when it was sent.
  await expect(
    sends.length === 0
      ? sheet.getByText('Not sent yet for this menu.')
      : sheet.getByText(/^Sent for this menu/),
  ).toBeVisible();
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();
  expect(errors).toEqual([]);
});

test('the customer reads the explanation and says Not now', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'phone only');
  const errors = collectErrors(page);
  await markHowItWorksSeen(page.context());
  await page.goto('/onde-onde/dishes'); // the settings page knows the kitchen the phone last visited
  await page.goto('/settings');

  const row = page.getByRole('switch', { name: /^New menus from/ });
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('aria-checked', 'false');
  await row.click();
  const ask = page.getByRole('dialog', { name: /^Hear about new .* menus\?$/ });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Not now' }).click();
  await expect(ask).toBeHidden();
  await expect(row).toHaveAttribute('aria-checked', 'false');
  expect(errors).toEqual([]);
});
