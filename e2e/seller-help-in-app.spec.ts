import { expect, test } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Plan 079: Help opens inside the seller app. The left menu (phone: the tab bar) stays, so one tap
// returns to Orders. The public address (/help-yw4xsvh8) is not touched here.

test('Help opens inside the seller app and one tap returns to Orders', async ({
  page,
  isMobile,
}) => {
  const errors = collectErrors(page);
  await page.goto('/seller');

  if (isMobile) {
    await page.getByRole('link', { name: 'More' }).click();
    await page.getByText('Help', { exact: true }).click();
  } else {
    await page.getByRole('link', { name: 'Help' }).click();
  }
  await expect(page).toHaveURL(/\/seller\/help$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Seller help' })).toBeVisible();

  // The menu is still there: the left menu, or the phone tab bar.
  const menu = page.getByRole('navigation', { name: isMobile ? /./ : 'Seller' }).first();
  await expect(menu).toBeVisible();
  const orders = page.getByRole('link', { name: 'Orders' }).first();
  await expect(orders).toBeVisible();

  // The page does not scroll as a whole; the menu never leaves the screen.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await orders.click();
  await expect(page).toHaveURL(/\/seller(\/orders)?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Seller help' })).toBeHidden();
  expect(errors).toEqual([]);
});

test('a ?topic= link opens that topic inside the app', async ({ page, isMobile }) => {
  const errors = collectErrors(page);
  await page.goto('/seller/help?topic=3');
  await expect(page).toHaveURL(/\/seller\/help\?topic=3$/);
  if (isMobile) {
    await expect(page.getByRole('link', { name: 'Orders' }).first()).toBeVisible();
    await expect(page.locator('button[aria-controls="help-topic-2"]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  } else {
    await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(/^3\./);
  }
  expect(errors).toEqual([]);
});
