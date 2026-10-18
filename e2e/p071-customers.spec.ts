import { expect, test } from '@playwright/test';
import { searchFor, orderRow } from './sellerHelpers';

// Plan 071 stage 4: confirming an order from an unknown phone asks "Order ... is confirmed" (link window); a
// finished menu with new customer data asks "Back up your customer details?". Captures: captures/p071.
// The finished menu is faked in the browser (the answer is rewritten), so the shared store is untouched.
test.use({ viewport: { width: 390, height: 844 } });

test('link sheet at confirm, then the backup prompt when the menu is finished', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'phone only');
  const firstName = `Link-${Date.now()}`;
  const created = await request.post('/api/s/onde-onde/orders', {
    data: {
      firstName,
      language: 'en',
      lines: [{ itemId: 'nasi-campur', qty: 1 }],
      fulfilment: 'pickup',
      customerCode: 'a1b2c3d4e5f6a1b2c3d4e5f6',
    },
  });
  expect(created.ok()).toBe(true);

  await page.goto('/seller/orders');
  await searchFor(page, firstName);
  await orderRow(page, new RegExp(firstName)).click();
  await page.getByRole('button', { name: 'Confirm only', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: /Order [A-Z0-9-]+ is confirmed/ });
  await expect(sheet).toBeVisible();
  await page.screenshot({ path: 'captures/p071/link-sheet.png' });
  await expect(sheet.getByText(/isn't in your list yet|We found/)).toBeVisible();
  await sheet.getByLabel('WhatsApp number (optional)').fill('0412 345 678');
  await sheet.getByRole('button', { name: 'Add to my list' }).click();
  await expect(sheet).toBeHidden();

  // The menu is finished and the device has a new customer: the backup prompt.
  await page.route('**/api/seller/menus/current', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const body = (await response.json()) as { menu: { menu: { state: string } } };
    body.menu.menu.state = 'finished';
    return route.fulfill({ response, json: body });
  });
  await page.goto('/seller/orders');
  const prompt = page.getByRole('dialog', { name: 'Back up your customer details?' });
  await expect(prompt).toBeVisible();
  await page.screenshot({ path: 'captures/p071/backup-prompt.png' });
  await prompt.getByRole('button', { name: 'Later' }).click();
  await expect(prompt).toBeHidden();
});
