import { expect, test, type Page } from '@playwright/test';
import { orderRow, searchFor } from './sellerHelpers';

function watchConsole(page: Page): Array<string> {
  const errors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

// Stage 3.5: an order placed by a customer on a phone shows up on the seller's desktop screen.
// The mock store is shared: this test never resets it and never asserts global counts; it finds
// its own order by a unique first name.
test('an order placed by a customer reaches the seller, who confirms it and marks it ready', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit', 'one run, on the iPhone project');
  const customerErrors = watchConsole(page);
  const firstName = `Flow-${Date.now()}`;
  const note = 'Less spicy please';

  // Customer (iPhone): two pesmol, one tempe, a name and a note.
  await page.goto('/onde-onde');
  const addPesmol = page.getByRole('button', { name: 'Add one Tilapia pesmol' });
  await addPesmol.click();
  await addPesmol.click();
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await expect(page.getByText('3 items · $40.00')).toBeVisible();
  await page.screenshot({ path: 'captures/flow-1-menu.png', fullPage: true });

  await page.getByRole('button', { name: /View basket/ }).click();
  await expect(page).toHaveURL(/\/basket$/);
  await page.getByLabel('Your first name').fill(firstName);
  await page.getByLabel('Note for the seller (optional)').fill(note);
  await page.screenshot({ path: 'captures/flow-2-basket.png', fullPage: true });
  await page.getByRole('button', { name: 'Place order · $40.00' }).click();

  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  const code = page.getByTestId('order-code');
  await expect(code).toHaveText(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
  await expect(page.getByText(`Note: ${note}`)).toBeVisible();
  await page.screenshot({ path: 'captures/flow-3-order-placed.png', fullPage: true });
  const orderCode = (await code.textContent()) ?? '';

  // Seller (desktop): a second browser context, as another device.
  const seller = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1280, height: 800 },
  });
  try {
    const sellerPage = await seller.newPage();
    const sellerErrors = watchConsole(sellerPage);
    await sellerPage.goto('/seller');
    await expect(sellerPage.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
    await searchFor(sellerPage, firstName);
    await expect(sellerPage).toHaveURL(/\/seller\?q=Flow-/);
    const row = orderRow(sellerPage, new RegExp(firstName));
    await expect(row).toBeVisible();
    await expect(row).toContainText(orderCode);
    await expect(row).toContainText('$40.00');
    await sellerPage.screenshot({ path: 'captures/flow-4-seller-list.png', fullPage: true });

    await row.click();
    await expect(sellerPage).toHaveURL(/\/seller\/orders\/[A-Z0-9]+\?q=/);
    await expect(sellerPage.getByText(note)).toBeVisible();
    await expect(sellerPage.getByText('2× Tilapia pesmol')).toBeVisible();
    await expect(sellerPage.getByText('1× Thin battered tempeh')).toBeVisible();

    await sellerPage.getByRole('button', { name: 'Confirm order', exact: true }).click();
    const ready = sellerPage.getByRole('button', { name: 'Mark ready for pickup', exact: true });
    await expect(ready).toBeVisible();
    await ready.click();
    await expect(
      sellerPage.getByRole('button', { name: 'Mark collected', exact: true }),
    ).toBeVisible();
    await sellerPage.screenshot({ path: 'captures/flow-5-seller-ready.png', fullPage: true });

    expect(sellerErrors).toEqual([]);
  } finally {
    await seller.close();
  }

  // The customer's order page picks up the new status on reload.
  await page.reload();
  await expect(page.getByText('Ready for pickup')).toBeVisible();
  await page.screenshot({ path: 'captures/flow-6-customer-ready.png', fullPage: true });
  expect(customerErrors).toEqual([]);
});
