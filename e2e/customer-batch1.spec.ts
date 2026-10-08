import { expect, test } from '@playwright/test';

// The server's mock store is shared by parallel tests: no reset, no assertions on global counts.
test('customer flow: menu, basket, order placed, WhatsApp text, Indonesian', async ({
  page,
  context,
}, testInfo) => {
  const consoleErrors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  // WhatsApp is never contacted from tests.
  await context.route('https://wa.me/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>wa</p>' }),
  );

  const shot = (screen: string) =>
    page.screenshot({
      path: `captures/customer-${screen}-${testInfo.project.name}.png`,
      fullPage: true,
    });
  const firstName = `Rina-${Date.now()}-${testInfo.project.name}`.slice(0, 40);

  // C1 menu
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Delave' })).toBeVisible();
  const addLemper = page.getByRole('button', { name: 'Add one Chicken lemper' });
  await addLemper.click();
  await addLemper.click();
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await expect(page.getByText('3 items · $30.00')).toBeVisible();
  await shot('menu');

  // C2 basket and checkout
  await page.getByRole('button', { name: /View basket/ }).click();
  await expect(page).toHaveURL(/\/basket$/);
  await expect(page.getByRole('button', { name: 'Place order · $30.00' })).toBeVisible();
  await page.getByLabel('Your first name').fill(firstName);
  await page.getByLabel('Note for the seller (optional)').fill('No chilli on the tempeh please');
  await shot('basket');
  await page.getByRole('button', { name: 'Place order · $30.00' }).click();

  // C3 order placed: the order page has its own link
  await expect(page).toHaveURL(/\/o\/[^/]+$/);
  const code = page.getByTestId('order-code');
  await expect(code).toHaveText(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
  await expect(page.getByText('Note: No chilli on the tempeh please')).toBeVisible();
  await expect(page.getByText('Saved in My orders on this phone')).toBeVisible();
  await shot('placed');

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Send to seller on WhatsApp' }).click(),
  ]);
  const url = new URL(popup.url());
  expect(url.origin + url.pathname).toBe('https://wa.me/');
  const text = url.searchParams.get('text') ?? '';
  expect(text).toContain(`my order is ${(await code.textContent()) ?? ''}`);
  expect(text).toContain('2× Chicken lemper, 1× Thin battered tempeh');
  expect(text).toContain('Total $30.00');
  expect(text).toContain(`Name: ${firstName}`);
  await popup.close();

  // The order is remembered on this phone.
  const saved = await page.evaluate(() => localStorage.getItem('myOrders'));
  expect(saved).toContain((await code.textContent())?.replace('-', '') ?? '');

  // Indonesian
  await page.getByRole('radio', { name: 'ID' }).click();
  await expect(page.getByText('Pesanan diterima')).toBeVisible();
  await expect(page.getByText('Kirim ke penjual lewat WhatsApp')).toBeVisible();
  await shot('placed-id');

  expect(consoleErrors).toEqual([]);
});

test('customer menu in Indonesian shows Indonesian item names and dates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'ID' }).click();
  await expect(page.getByText('Lemper ayam')).toBeVisible();
  await expect(page.getByText('Sabtu, 10 Okt')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pesanan saya' })).toBeVisible();
});

test('Back from the basket returns to the menu with the basket intact', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add one Chicken lemper' }).click();
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await expect(page.getByText('2 items · $20.00')).toBeVisible();
  await page.getByRole('button', { name: /View basket/ }).click();
  await expect(page).toHaveURL(/\/basket$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('2 items · $20.00')).toBeVisible();
  // Forward again: the basket page still has both lines.
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Place order · $20.00' })).toBeVisible();
});
