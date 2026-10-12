import { expect, test } from '@playwright/test';
import type { MenuResponse } from '../shared/menuContract';
import { markHowItWorksSeen } from './customerHelpers';

// Plan 066 stage 3 (customer): a 50-dish menu on a phone. The menu answer is stretched to 50 dishes
// in the browser (page.route), so no real data is touched. Capture: captures/p066/customer-50.png.
test.use({ viewport: { width: 390, height: 844 } });

test('50 dishes: the dishes page scrolls, the basket holds 50 lines', async ({ page, context }) => {
  await markHowItWorksSeen(context);
  await page.route('**/api/s/onde-onde/menu', async (route) => {
    const response = await route.fetch();
    const menu = (await response.json()) as MenuResponse;
    const base = menu.items[0];
    if (!base) throw new Error('the dev menu has no dish to copy');
    const items = Array.from({ length: 50 }, (_, index) => ({
      ...base,
      id: `dish-${String(index + 1)}`,
      name: { en: `Dish ${String(index + 1)}`, id: `Hidangan ${String(index + 1)}` },
      soldOut: false,
      remaining: null,
      preorder: true,
    }));
    await route.fulfill({ response, json: { ...menu, items } });
  });
  await page.goto('/onde-onde/dishes');
  await expect(page.getByRole('button', { name: 'Add one Dish 50' })).toBeAttached();
  await page.screenshot({ path: 'captures/p066/customer-50.png' });
  for (let index = 1; index <= 50; index += 1) {
    await page.getByRole('button', { name: `Add one Dish ${String(index)}`, exact: true }).click();
  }
  await expect(page.getByText(/^50 items/)).toBeVisible();
  await page.getByRole('button', { name: /View basket/ }).click();
  await expect(page).toHaveURL(/\/basket$/);
  await expect(page.getByRole('button', { name: 'Remove Dish 50', exact: true })).toBeAttached();
  await expect(page.getByRole('button', { name: /^Remove Dish \d+$/ })).toHaveCount(50);
});
