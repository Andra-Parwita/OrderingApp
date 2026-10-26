import { expect, test } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Plan 075: the seller About page. Reached from the menu (left panel on a tablet or desktop,
// More on a phone), shows the about card and the version, and opens the releases panel.
// Runs in the default "mobile-chromium" and "desktop-chromium" projects (no config change).

test('About opens from the menu, shows the card, and the releases panel opens and closes', async ({
  page,
  isMobile,
}) => {
  const errors = collectErrors(page);
  await page.goto('/seller');

  if (isMobile) {
    await page.getByRole('link', { name: 'More' }).click();
    await page.getByText('About', { exact: true }).click();
  } else {
    await page.getByRole('link', { name: 'About' }).click();
  }
  await expect(page).toHaveURL(/\/seller\/about$/);
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Hey, we're ShaggyBobo/ })).toBeVisible();
  await expect(page.getByText(/^Version \d/)).toBeVisible();

  // The releases panel: current release open, Escape closes, focus returns to the button.
  const open = page.getByRole('button', { name: "What's new", exact: true });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Releases' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Current')).toBeVisible();
  await expect(dialog.getByText('We show the last 5 releases.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();

  // The page itself did not scroll while the panel was open and closed.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(errors).toEqual([]);
});
