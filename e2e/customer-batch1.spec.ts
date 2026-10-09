import { expect, test } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';
import { sampleDayId } from './sellerHelpers';

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

  // C1 menu home, then the dishes
  await markHowItWorksSeen(context);
  await page.goto('/onde-onde');
  await expect(page.getByRole('heading', { name: 'Onde Onde' })).toBeVisible();
  await page.getByRole('button', { name: 'See dishes and order' }).click();
  await expect(page).toHaveURL(/\/onde-onde\/dishes$/);
  const addPesmol = page.getByRole('button', { name: 'Add one Tilapia pesmol' });
  await addPesmol.click();
  await addPesmol.click();
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await expect(page.getByText('3 items · $40.00')).toBeVisible();
  await shot('menu');

  // C2 basket and checkout
  await page.getByRole('button', { name: /View basket/ }).click();
  await expect(page).toHaveURL(/\/basket$/);
  await expect(page.getByText('Total', { exact: true })).toBeVisible();
  await shot('basket');
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await expect(page).toHaveURL(/\/basket\/name$/);
  await expect(page.getByRole('button', { name: 'Place order · $40.00' })).toBeVisible();
  await page.getByLabel('First name').fill(firstName);
  await page.getByLabel(/^Note/).fill('No chilli on the tempeh please');
  await shot('name');
  await page.getByRole('button', { name: 'Place order · $40.00' }).click();

  // C3 order placed: the order page has its own link
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  const code = page.getByTestId('order-code');
  await expect(code).toHaveText(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
  await expect(page.getByText('Saved in My orders on this phone')).toBeVisible();
  await shot('placed');

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /^Send to .* on WhatsApp$/ }).click(),
  ]);
  const url = new URL(popup.url());
  expect(url.origin + url.pathname).toBe('https://wa.me/');
  const text = url.searchParams.get('text') ?? '';
  expect(text).toContain(`my order is ${(await code.textContent()) ?? ''}`);
  expect(text).toContain('2× Tilapia pesmol, 1× Thin battered tempeh');
  expect(text).toContain('Total $40.00');
  expect(text).toContain(`Name: ${firstName}`);
  await popup.close();

  // The order is remembered on this phone.
  const saved = await page.evaluate(() => localStorage.getItem('myOrders'));
  expect(saved).toContain((await code.textContent())?.replace('-', '') ?? '');

  // Indonesian: the language switch lives in Settings (a tab, so the order stays in My orders).
  const placedPath = new URL(page.url()).pathname;
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'ID' }).click();
  await page.goto(placedPath);
  await expect(page.getByText('Pesanan terkirim')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Kirim ke .* lewat WhatsApp$/ })).toBeVisible();
  await shot('placed-id');

  expect(consoleErrors).toEqual([]);
});

test('customer menu in Indonesian shows Indonesian item names and dates', async ({
  page,
  context,
}) => {
  await markHowItWorksSeen(context);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'ID' }).click();
  await page.goto('/onde-onde/dishes');
  await expect(page.getByText('Pesmol ikan nila')).toBeVisible();
  await expect(page.getByText(sampleDayId()).first()).toBeVisible();
  await page.goto('/onde-onde');
  await expect(page.getByRole('link', { name: 'Pesanan saya' })).toBeVisible();
});

test('Back from the basket returns to the dishes with the basket intact', async ({
  page,
  context,
}) => {
  await markHowItWorksSeen(context);
  await page.goto('/onde-onde/dishes');
  await page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await expect(page.getByText('2 items · $25.00')).toBeVisible();
  await page.getByRole('button', { name: /View basket/ }).click();
  await expect(page).toHaveURL(/\/basket$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/onde-onde\/dishes$/);
  await expect(page.getByText('2 items · $25.00')).toBeVisible();
  // Forward again: the basket page still has both lines, and the next page opens.
  await page.goForward();
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await expect(page.getByRole('button', { name: 'Place order · $25.00' })).toBeVisible();
});
