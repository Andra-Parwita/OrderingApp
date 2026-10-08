import { expect, test } from '@playwright/test';

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

  await page.getByLabel('Order code or name').fill(firstName);
  await expect(page).toHaveURL(/[?&]q=/);
  const row = page.getByRole('button', { name: new RegExp(firstName) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('✎ Note');
  await expect(row).toContainText('$30.00');
  await page.screenshot({
    path: `captures/seller-orders-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await row.click();
  await expect(page).toHaveURL(/\/seller\/orders\/[A-Z0-9]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('No chilli please')).toBeVisible();

  await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
  const ready = page.getByRole('button', { name: 'Ready for pickup', exact: true });
  await expect(ready).toBeVisible();
  await ready.click();
  await expect(page.getByRole('button', { name: 'Collected', exact: true })).toBeVisible();

  await page.getByRole('radio', { name: 'Paid', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Paid', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  const history = page.getByRole('list');
  await expect(history.getByRole('listitem')).toHaveCount(4);
  await expect(history.getByRole('listitem').nth(0)).toContainText('Marked paid');
  await expect(history.getByRole('listitem').nth(1)).toContainText('Status → Ready for pickup');
  await expect(history.getByRole('listitem').nth(2)).toContainText('Status → Confirmed');
  await expect(history.getByRole('listitem').nth(3)).toContainText('Placed');
  await page.screenshot({
    path: `captures/seller-detail-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.getByRole('radio', { name: 'ID', exact: true }).click();
  await expect(page.getByText('Perubahan terakhir')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Batalkan pesanan' })).toBeVisible();

  // Back restores the list with the search still in the URL.
  await page.getByRole('button', { name: '‹ Pesanan' }).click();
  await expect(page).toHaveURL(/\/seller\?q=/);
  await expect(page.getByLabel('Kode pesanan atau nama')).toHaveValue(firstName);

  expect(consoleErrors).toEqual([]);
});
