import { expect, test } from '@playwright/test';
import { goToName, markHowItWorksSeen } from './customerHelpers';
import { orderRow, searchFor } from './sellerHelpers';

// Plan 074: the customer's order page changes the moment the seller moves the order, pushed over
// the app's one live connection, without a reload.
test('the seller marks an order ready and the open customer page shows it within 2 seconds', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-chromium', 'one run, on the iPhone project');
  const firstName = `Live-${Date.now()}`;

  await markHowItWorksSeen(page.context());
  await page.goto('/onde-onde/dishes');
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await goToName(page);
  await page.getByLabel('First name').fill(firstName);
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  await page.getByRole('button', { name: 'View order details' }).click();
  await expect(page.getByText(/Ordered/).first()).toBeVisible();
  // A marker proves the page is never reloaded.
  await page.evaluate(() => {
    (window as unknown as { liveMarker: number }).liveMarker = 1;
  });

  const seller = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1280, height: 800 },
  });
  try {
    const sellerPage = await seller.newPage();
    await sellerPage.goto('/seller/orders');
    await expect(sellerPage.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
    await searchFor(sellerPage, firstName);
    await orderRow(sellerPage, new RegExp(firstName)).click();
    await sellerPage.getByRole('button', { name: 'Confirm order', exact: true }).click();
    // A first-time phone asks whether to link a saved customer (plans 071, 106): close the window.
    await sellerPage.getByRole('button', { name: 'Ask me next time', exact: true }).click();
    const ready = sellerPage.getByRole('button', { name: 'Ready for pickup', exact: true });
    await expect(ready).toBeVisible();
    await ready.click();
    await expect(
      sellerPage.getByRole('button', { name: 'Mark collected', exact: true }),
    ).toBeVisible();
    // The click already happened; the customer's page must follow without a reload.
    await expect(page.getByText(/Ready for pickup/).first()).toBeVisible({ timeout: 2000 });
    expect(
      await page.evaluate(() => (window as unknown as { liveMarker?: number }).liveMarker),
    ).toBe(1);
  } finally {
    await seller.close();
  }
});
