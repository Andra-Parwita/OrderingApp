import { expect, test } from '@playwright/test';
import { collectErrors, pageScrollWidth } from './sellerHelpers';

// Plan 029: selling on the day, one sell flow on the phone. Uses the unlimited item
// "tempe-mendoan" and puts it back (no day stock) at the end, because the mock store is shared by
// the other specs. Runs on the Android phone project only.

const ITEM = 'tempe-mendoan';
const NAME = 'Thin battered tempeh';

test('sell on the phone: -1, undo, set count, then the summary', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'day-selling-mobile-chromium', 'Phone (Android) only');
  const errors = collectErrors(page);
  const patch = (data: object) =>
    request.patch(`/api/seller/menu/items/${ITEM}`, { headers: { 'X-Seller': 'onde-onde' }, data });
  expect((await patch({ dayStock: 3 })).ok()).toBe(true);
  try {
    await page.goto('/seller/sell');
    const card = page.getByTestId(`sell-${ITEM}`);
    const stock = card.getByLabel(`${NAME}: portions left`);
    await expect(stock).toHaveText('3');

    await card.getByRole('button', { name: `Sell one ${NAME}` }).click();
    await expect(stock).toHaveText('2');
    await expect(page.getByRole('status')).toContainText(`Sold 1 × ${NAME}`);

    // Undo within the 5 seconds gives the portion back.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(stock).toHaveText('3');
    await expect(page.getByRole('status')).toHaveCount(0);

    // Sell two at once, then correct the count.
    await card.getByRole('textbox', { name: 'Number' }).fill('2');
    await card.getByRole('button', { name: `Sell the number of ${NAME}` }).click();
    await expect(stock).toHaveText('1');
    await card.getByRole('textbox', { name: 'Number' }).fill('6');
    await card.getByRole('button', { name: `Set the count of ${NAME}` }).click();
    await expect(stock).toHaveText('6');

    // The end-of-day summary adds up: 2 sold on the day (the undone sale is not counted).
    await page.getByRole('radio', { name: 'Summary' }).click();
    const row = page.getByRole('row').filter({ hasText: NAME }).first();
    await expect(row.getByRole('cell').nth(2)).toHaveText('2');
    await expect(row.getByRole('cell').nth(3)).toHaveText('6');
    await expect(page.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
    expect(await pageScrollWidth(page)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  } finally {
    await patch({ dayStock: null });
  }
  expect(errors).toEqual([]);
});
