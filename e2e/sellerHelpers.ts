// Specs share one mock store per run: never order limited items (Lemper, Empek-empek) except in
// limits.spec.ts; never reset the store; never assert global counts. Use unlimited items
// (nasi-campur, pesmol, ayam-goreng, tempe-mendoan) and find your own orders by a unique name.

import type { Locator, Page } from '@playwright/test';

// The seller's order list is a card list on a phone and a table on a desktop (1024 px and up).
// These helpers let one spec drive both without caring which.

/** The project that runs at a desktop width (Desktop Chrome is 1280 px wide). */
export const isDesktopProject = (projectName: string): boolean => projectName.includes('desktop');

/** The search box: "Order code or name" on a phone, "Find an order (code or name)" on a desktop. */
export const searchBox = (page: Page): Locator =>
  page.getByLabel(/^(Order code or name|Find an order \(code or name\))$/);

/** An order in the list, by (part of) its name: a table row on a desktop, a button on a phone. */
export const orderRow = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('row', { name }).or(page.getByRole('button', { name }));

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
