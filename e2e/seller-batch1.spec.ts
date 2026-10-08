import { expect, test } from '@playwright/test';
import { isDesktopProject, orderRow, searchBox } from './sellerHelpers';

// The mock store is shared by parallel tests: this spec never resets it and never asserts global
// counts; it finds its own order by a unique first name.
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
  const created = await request.post('/api/orders', {
    data: {
      firstName,
      language: 'en',
      lines: [{ itemId: 'nasi-campur', qty: 2 }],
      fulfilment: 'pickup',
      note: 'No chilli please',
    },
  });
  expect(created.ok()).toBe(true);

  await page.goto('/seller');
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();

  await searchBox(page).fill(firstName);
  await expect(page).toHaveURL(/[?&]q=/);
  const row = orderRow(page, new RegExp(firstName));
  await expect(row).toBeVisible();
  // A new customer's row shows that one flag first; the note is read in the panel.
  await expect(row).toContainText(desktop ? 'New customer' : 'Note');
  await expect(row).toContainText('$30.00');
  await page.screenshot({
    path: `captures/seller-orders-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await row.click();
  await expect(page).toHaveURL(/\/seller\/orders\/[A-Z0-9]+\?q=/);
  if (desktop) await expect(page.getByRole('dialog')).toBeVisible();
  else await expect(page.getByRole('heading', { level: 1 }).last()).toBeVisible();
  await expect(page.getByText('No chilli please')).toBeVisible();

  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  const ready = page.getByRole('button', { name: 'Mark ready for pickup', exact: true });
  await expect(ready).toBeVisible();
  await ready.click();
  await expect(page.getByRole('button', { name: 'Mark collected', exact: true })).toBeVisible();

  if (desktop) {
    await page.getByRole('button', { name: 'Mark paid' }).click();
    await expect(page.getByRole('button', { name: 'Mark not paid' })).toBeVisible();
    await page.getByText('Last changes').click();
  } else {
    await page.getByRole('radio', { name: 'Paid', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Paid', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  }

  // The history is a list: pick it by what it says.
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
    // The panel dims the table and the rail: close it, switch language, open the order again.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('radio', { name: 'ID', exact: true }).click();
    await orderRow(page, new RegExp(firstName)).click();
    await expect(page.getByRole('button', { name: 'Batalkan pesanan' })).toBeVisible();
    await page.getByText('Perubahan terakhir').click();
    await expect(page.getByText('Perubahan terakhir')).toBeVisible();
    await page.getByRole('button', { name: 'Tutup' }).click();
    await expect(page).toHaveURL(/\/seller\?q=/);
    await expect(page.getByLabel('Cari pesanan (kode atau nama)')).toHaveValue(firstName);
  } else {
    await page.getByRole('radio', { name: 'ID', exact: true }).last().click();
    await expect(page.getByText('Perubahan terakhir')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batalkan pesanan' })).toBeVisible();

    // Back restores the list with the search still in the URL.
    await page.getByRole('button', { name: '‹ Pesanan' }).click();
    await expect(page).toHaveURL(/\/seller\?q=/);
    await expect(page.getByLabel('Kode pesanan atau nama')).toHaveValue(firstName);
  }

  expect(consoleErrors).toEqual([]);
});
