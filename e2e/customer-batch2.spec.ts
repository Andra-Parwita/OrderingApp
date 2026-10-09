import { expect, test } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';

// Batch 2, customer side (C4 My orders, C5 order page, basket edit mode) on the real routes. The
// order is placed through the real customer flow so My orders is filled the way a customer fills it.
// The server's mock store is shared by parallel tests: no reset, no assertions on global counts.
test('customer batch 2: place, My orders, order page, change, seller nudge and lock', async ({
  page,
  context,
}, testInfo) => {
  const consoleErrors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await context.route('https://wa.me/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>wa</p>' }),
  );

  const shot = (screen: string) =>
    page.screenshot({
      path: `captures/customer2-${screen}-${testInfo.project.name}.png`,
      fullPage: true,
    });
  const firstName = `Dewi-${Date.now()}-${testInfo.project.name}`.slice(0, 40);

  // Place an order (tempeh has no portion limit, so parallel runs never sell it out).
  await markHowItWorksSeen(context);
  await page.goto('/onde-onde/dishes');
  const add = page.getByRole('button', { name: 'Add one Thin battered tempeh' });
  await add.click();
  await add.click();
  await page.getByRole('button', { name: /View basket/ }).click();
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await page.getByLabel('First name').fill(firstName);
  await page.getByRole('button', { name: 'Place order · $20.00' }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  const codeText = (await page.getByTestId('order-code').textContent()) ?? '';
  expect(codeText).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
  const code = codeText.replace('-', '');

  // The confirmation leads on to the order page.
  await page.getByRole('button', { name: 'Change or cancel' }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+$/);
  await expect(page.getByRole('button', { name: 'Change order' })).toBeVisible();

  // C4 My orders: the order is there, and typing its code opens it.
  await page.goto('/my-orders');
  await expect(page.getByText('Current', { exact: true })).toBeVisible();
  const row = page.getByRole('button', { name: new RegExp(codeText) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('2 × Thin battered tempeh');
  await expect(row).toContainText('Ordered');
  await expect(row).toContainText('$20.00');
  await shot('list');
  await page.getByLabel('Order code').fill(code.toLowerCase());
  await expect(page.getByTestId('order-code')).toHaveText(codeText);

  // C5 order page.
  await expect(page.getByTestId('timeline')).toContainText('Ordered');
  await expect(page.getByRole('button', { name: 'Show QR code' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change order' })).toBeVisible();
  await shot('order');

  const token = await page.evaluate((wanted) => {
    const saved = JSON.parse(localStorage.getItem('myOrders') ?? '[]') as Array<{
      code: string;
      token: string;
    }>;
    return saved.find((entry) => entry.code === wanted)?.token ?? '';
  }, code);
  expect(token).not.toBe('');

  // Change the quantity: basket in edit mode, then back to the order page with the change.
  await page.getByRole('button', { name: 'Change order' }).click();
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await shot('edit');
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await page.getByRole('button', { name: 'Update order · $30.00' }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+$/);
  await expect(page.getByTestId('order-code')).toHaveText(codeText);
  await expect(page.getByText('3 × Thin battered tempeh')).toBeVisible();
  await expect(page.getByText('$30.00').first()).toBeVisible();

  // The seller nudges, then locks (seller-side API calls; the page polls every 15 s, so open it fresh).
  expect((await page.request.post(`/api/seller/orders/${code}/nudge`)).ok()).toBe(true);
  expect(
    (await page.request.post(`/api/seller/orders/${code}/lock`, { data: { locked: true } })).ok(),
  ).toBe(true);
  await page.goto(`/o/${token}`);
  await expect(page.getByTestId('updates')).toContainText(
    'The seller is waiting for your order number on WhatsApp.',
  );
  await expect(
    page.getByText('The seller has locked this order. Message them on WhatsApp to change it.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change order' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
  await shot('locked');

  // Indonesian
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'ID' }).click();
  await page.goto(`/o/${token}`);
  await expect(page.getByText('Kabar dari penjual')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Kirim pesan ke .* lewat WhatsApp$/ }),
  ).toBeVisible();
  await shot('locked-id');

  expect(consoleErrors).toEqual([]);
});
