import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { collectErrors } from './sellerHelpers';

// Labels and backup, through the dev harness (6.3 adds the routes). The mock store is shared by
// parallel tests: this spec never resets it, never restores a backup, never asserts global counts,
// and orders only unlimited items. It finds its own order by a unique name and note.

const LONG_NOTE =
  'No peanuts at all please, my daughter is allergic, and also no sesame oil or shrimp paste thanks';

async function placeOrder(request: APIRequestContext, firstName: string, note: string) {
  const created = await request.post('/api/s/onde-onde/orders', {
    data: {
      firstName,
      language: 'en',
      lines: [{ itemId: 'nasi-campur', qty: 2 }],
      fulfilment: 'pickup',
      note,
    },
  });
  expect(created.ok()).toBe(true);
}

test('labels show the order with its note cut to 70 characters', async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop only');
  const errors = collectErrors(page);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const name = `Lia${String(Date.now()).slice(-6)}`;
  await placeOrder(request, name, `${stamp} ${LONG_NOTE}`);

  await page.goto('/?harness=seller-history&screen=labels');
  await expect(page.getByRole('heading', { level: 1, name: 'Print labels' })).toBeVisible();
  // A new order is "Ordered", not "Confirmed", so look at everything not cancelled.
  await page.getByRole('radio', { name: /^All not cancelled/ }).click();
  const label = page.getByRole('article').filter({ hasText: name });
  await expect(label).toBeVisible();
  await expect(label).toContainText(/Nasi campur/);
  await expect(label).toContainText(/Pickup · /);
  // The real QR: an SVG with drawn modules, not a placeholder.
  const qr = label.getByRole('img', { name: 'Order QR code' });
  await expect(qr).toBeVisible();
  await expect(qr.locator('path')).toHaveAttribute('d', /.{20,}/);
  // The note is cut: the stamp starts the note, so only its first 70 characters are shown.
  const noteLine = label.getByText(/…$/);
  await expect(noteLine).toBeVisible();
  expect(((await noteLine.textContent()) ?? '').length).toBeLessThanOrEqual(70);
  await expect(label).not.toContainText('shrimp paste');

  await page.screenshot({
    path: `captures/seller-labels-${testInfo.project.name}.png`,
    fullPage: true,
  });

  // Roll option, then the paper the printer sees: only the labels, no app controls.
  await page.getByRole('radio', { name: 'Label printer (62 mm roll)' }).click();
  await expect(page.getByTestId('label-sheets')).toHaveAttribute('data-paper', 'roll');
  await page.getByRole('radio', { name: 'A4 sheet (2 × 7 labels)' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Print' })).toBeHidden();
  await expect(label).toBeVisible();
  await page.screenshot({
    path: `captures/seller-labels-print-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.emulateMedia({ media: 'screen' });

  expect(errors).toEqual([]);
});

test('backup downloads a JSON file that parses, and the orders CSV', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop only');
  const errors = collectErrors(page);

  await page.goto('/?harness=seller-history&screen=backup');
  await expect(page.getByRole('heading', { level: 1, name: 'Backup' })).toBeVisible();

  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const file = await backup;
  expect(file.suggestedFilename()).toMatch(/^delave-onde-onde-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await file.path();
  const parsed = JSON.parse(await readFile(path, 'utf8')) as {
    version: number;
    seller: { slug: string };
    orders: Array<unknown>;
  };
  expect(parsed.version).toBe(1);
  expect(parsed.seller.slug).toBe('onde-onde');
  expect(Array.isArray(parsed.orders)).toBe(true);
  await expect(page.getByText(/^Last backup on this device: /)).toBeVisible();

  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download orders (CSV)' }).click();
  const csvFile = await csv;
  expect(csvFile.suggestedFilename()).toMatch(/^orders-onde-onde-\d{4}-\d{2}-\d{2}\.csv$/);
  const bytes = await readFile(await csvFile.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

  await page.screenshot({
    path: `captures/seller-backup-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('past weeks lists closed weeks', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop only');
  const errors = collectErrors(page);
  await page.goto('/?harness=seller-history&screen=past');
  await expect(page.getByRole('heading', { level: 1, name: 'Past weeks' })).toBeVisible();
  await expect(
    page.getByText('Order details are kept for 4 weeks, then only totals remain.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
