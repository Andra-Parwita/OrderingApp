import { expect, test } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Plan 042: the Print orders preview. Dapur Demo gets sample orders added (nothing is reset), so
// the preview has at least two A4 pages; every page carries the header and "Page N of M".

const SELLER = 'dapur-demo';

test('print preview renders A4 pages with a header on each', async ({
  browser,
  request,
}, testInfo) => {
  const sampled = await request.post('/api/dev/sample-orders', {
    headers: { 'X-Seller': SELLER },
    data: { count: 30 },
  });
  expect(sampled.ok()).toBe(true);

  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1180, height: 820 },
  });
  try {
    await context.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto('/seller/orders');
    await page.locator('main > header').getByRole('button', { name: 'Print' }).click();
    await expect(page).toHaveURL(/\/seller\/orders\/print$/);

    const sheets = page.getByTestId('print-page');
    await expect(sheets.first()).toBeVisible();
    const count = await sheets.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i += 1) {
      const sheet = sheets.nth(i);
      await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Dapur Demo');
      await expect(sheet).toContainText(`Page ${i + 1} of ${count}`);
      await expect(sheet).toContainText('Menu for');
      await expect(sheet).toContainText('Printed');
    }
    await expect(sheets.last().getByTestId('print-totals')).toBeVisible();

    await page.getByRole('radio', { name: 'Not paid' }).click();
    await page.getByRole('radio', { name: 'Code' }).click();
    await expect(sheets.first()).toBeVisible();
    await page.screenshot({ path: 'captures/p042/print-preview-1180x820.png' });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
