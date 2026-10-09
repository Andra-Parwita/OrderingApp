// Specs share one mock store per run: never order limited items (Lemper, Empek-empek) except in
// limits.spec.ts; never reset the store; never assert global counts. Use unlimited items
// (nasi-campur, pesmol, ayam-goreng, tempe-mendoan) and find your own orders by a unique name.

import { expect, type Locator, type Page } from '@playwright/test';
import { comingSaturday, formatCookingDate, formatDay } from '../shared/dates';

/** The sample week is the coming Saturday (the seed computes it from the clock): "Sat 10 Oct". */
export const sampleDay = (): string => formatDay(comingSaturday(new Date()), 'en');
/** The same day as the customer app shows it, in Indonesian: "Sabtu, 10 Okt". */
export const sampleDayId = (): string => formatCookingDate(comingSaturday(new Date()), 'id');

// Orders (plan 001) is a list with the order's panel beside it on a tablet or desktop (600 px and
// up) and a phone list under 600 px; a row is a button on both. These helpers let one spec drive
// both without caring which.

/** The project that runs at a desktop width (Desktop Chrome is 1280 px wide). */
export const isDesktopProject = (projectName: string): boolean => projectName.includes('desktop');

/** The search box, "Name or code" (on a phone it opens from the "Search orders" button). */
export const searchBox = (page: Page): Locator =>
  page.getByRole('searchbox', { name: 'Name or code' });

/** Types into the orders search; on a phone it opens the search first. */
export async function searchFor(page: Page, text: string): Promise<void> {
  const box = searchBox(page);
  const opener = page.getByRole('button', { name: 'Search orders' });
  await expect(box.or(opener)).toBeVisible();
  if (!(await box.isVisible())) await opener.click();
  await box.fill(text);
}

/** An order in the list, by (part of) its name: the row button (not the phone's WhatsApp button). */
export const orderRow = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('button', { name }).first();

/** Console errors and uncaught page errors, collected for a final `expect(errors).toEqual([])`. */
export function collectErrors(page: Page): Array<string> {
  const errors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** The page's scroll width, to prove nothing spills sideways. */
export async function pageScrollWidth(page: Page): Promise<number> {
  const width: unknown = await page.evaluate('document.documentElement.scrollWidth');
  return typeof width === 'number' ? width : Number.NaN;
}
