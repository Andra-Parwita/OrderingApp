import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * A first visit to a menu shows "How ordering works" by itself (once per phone). Specs that are not
 * about that page mark it seen on the device first, before any page script runs.
 */
export async function markHowItWorksSeen(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('howItWorksSeen', '1');
    } catch {
      // Storage blocked: nothing to mark.
    }
  });
}

/** The dishes page of a kitchen. */
export async function openDishes(page: Page, slug: string): Promise<void> {
  await page.goto(`/${slug}/dishes`);
  await expect(page.getByRole('heading', { name: 'Dishes' })).toBeVisible();
}

/** The three checkout pages after the dishes: basket → pickup place is optional → your name. */
export async function goToName(page: Page): Promise<void> {
  await page.getByRole('button', { name: /View basket/ }).click();
  await expect(page).toHaveURL(/\/basket$/);
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await expect(page).toHaveURL(/\/basket\/name$/);
}
