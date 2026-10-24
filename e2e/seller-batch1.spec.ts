import { expect, test } from '@playwright/test';
import { isDesktopProject, orderRow, searchBox, searchFor } from './sellerHelpers';

// The mock store is shared by parallel tests: this spec never resets it and never asserts global
// counts; it finds its own order by a unique first name. Orders (plan 001) is a list with the order
// beside it on a tablet or desktop and a phone list with a full-screen order under 600 px.
test('seller finds an order, confirms it, marks it ready and paid, and sees the history', async ({
  page,
  request,
}, testInfo) => {
  const consoleErrors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  const desktop = isDesktopProject(testInfo.project.name);
  const firstName = `Sari-${testInfo.project.name}-${Date.now()}`;
  const created = await request.post('/api/s/onde-onde/orders', {
    data: {
      firstName,
      language: 'en',
      lines: [{ itemId: 'nasi-campur', qty: 2 }],
      fulfilment: 'pickup',
      note: 'No chilli please',
    },
  });
  expect(created.ok()).toBe(true);

  await page.goto('/seller/orders');
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();

  await searchFor(page, firstName);
  await expect(page).toHaveURL(/[?&]q=/);
  const row = orderRow(page, new RegExp(firstName));
  await expect(row).toBeVisible();
  await expect(row).toContainText('$30.00');
  await expect(row).toContainText('Ordered');
  await page.screenshot({
    path: `captures/seller-orders-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await row.click();
  await expect(page).toHaveURL(/\/seller\/orders\/[A-Z0-9]+\?q=/);
  const order = page.url();
  if (desktop) await expect(page.getByRole('complementary', { name: /^Order / })).toBeVisible();
  else await expect(page.getByRole('button', { name: '‹ Orders' })).toBeVisible();
  await expect(page.getByText('No chilli please')).toBeVisible();

  // Confirm (a phone also offers "Confirm & send on WhatsApp"), then ready, then paid.
  await page
    .getByRole('button', { name: desktop ? 'Confirm order' : 'Confirm only', exact: true })
    .click();
  const ready = page.getByRole('button', { name: 'Ready for pickup', exact: true });
  await expect(ready).toBeVisible();
  await ready.click();
  // Collected is the main step once the order is ready (pickup).
  await expect(page.getByRole('button', { name: 'Mark collected', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark paid', exact: true }).click();
  // Plan 103 fix 7: Paid asks first, in a sheet.
  await page.getByRole('dialog').getByRole('button', { name: 'Mark paid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark not paid', exact: true })).toBeVisible();

  // The history is a list: pick it by what it says. Newest first.
  const history = page.getByRole('list').filter({ hasText: 'Marked paid' });
  await expect(history.getByRole('listitem')).toHaveCount(4);
  await expect(history.getByRole('listitem').nth(0)).toContainText('Marked paid');
  await expect(history.getByRole('listitem').nth(1)).toContainText('Status → Ready for pickup');
  await expect(history.getByRole('listitem').nth(2)).toContainText('Status → Confirmed');
  await expect(history.getByRole('listitem').nth(3)).toContainText('Placed');
  await page.screenshot({
    path: `captures/seller-detail-${testInfo.project.name}.png`,
    fullPage: true,
  });

  if (desktop) {
    // Close the panel, switch language in Settings → Language (plan 118: no switch in the rail),
    // come back to the list: the search is still in the URL. Open the order again.
    await page
      .getByRole('complementary', { name: /^Order / })
      .getByRole('button', { name: 'Close' })
      .click();
    await expect(page).toHaveURL(/\/seller\/orders\?q=/);
    const listUrl = page.url();
    await page.goto('/seller/settings/language');
    await page.getByRole('radio', { name: 'ID', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'ID', exact: true })).toBeChecked();
    await page.goto(listUrl);
    await expect(page).toHaveURL(/\/seller\/orders\?q=/);
    await orderRow(page, new RegExp(firstName)).click();
    // Cancel now sits in the panel's ⋯ menu (Lainnya).
    await page
      .getByRole('complementary')
      .getByRole('button', { name: 'Lainnya', exact: true })
      .click();
    await expect(page.getByRole('menuitem', { name: 'Batalkan pesanan' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Perubahan terakhir' })).toBeVisible();
    await page.getByRole('button', { name: 'Tutup', exact: true }).click();
    await expect(page).toHaveURL(/\/seller\/orders\?q=/);
    await expect(
      searchBox(page).or(page.getByRole('searchbox', { name: 'Nama atau kode' })),
    ).toHaveValue(firstName);
  } else {
    // A phone changes language in More; back restores the list with the search in the URL.
    await page.getByRole('button', { name: '‹ Orders' }).click();
    await expect(page).toHaveURL(/\/seller\/orders\?q=/);
    await page.getByRole('link', { name: 'More' }).click();
    await page.getByRole('radio', { name: 'ID', exact: true }).click();
    await page.goto(order);
    await expect(page.getByRole('heading', { name: 'Perubahan terakhir' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batalkan pesanan' })).toBeVisible();
    await page.getByRole('button', { name: '‹ Pesanan' }).click();
    await expect(page).toHaveURL(/\/seller\/orders\?q=/);
    await expect(page.getByRole('searchbox', { name: 'Nama atau kode' })).toHaveValue(firstName);
  }

  expect(consoleErrors).toEqual([]);
});
