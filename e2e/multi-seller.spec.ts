import { expect, test, type Page } from '@playwright/test';
import { collectErrors, orderRow, searchBox } from './sellerHelpers';

// Stage 5.2 (D-036, D-037): one app, many sellers. Orders are placed at two sellers' own links,
// My orders spans both, and the seller side (dev picker) only ever shows the chosen seller's
// orders. The store is shared with the other specs: nothing here resets it or counts globally;
// orders are found by unique names. Only unlimited items are ordered (pesmol, Iced sweet tea).
test('two sellers: orders at each link, My orders across both, the seller side per seller', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one run, on the desktop project');
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  const stamp = Date.now();
  const ondeName = `Onde-${stamp}`;
  const demoName = `Demo-${stamp}`;

  async function order(path: string, add: string, firstName: string): Promise<void> {
    await page.goto(path);
    await page.getByRole('button', { name: add }).click();
    await page.getByRole('button', { name: /View basket/ }).click();
    await expect(page).toHaveURL(new RegExp(`${path}/basket$`));
    await page.getByLabel('Your first name').fill(firstName);
    await page.getByRole('button', { name: /^Place order/ }).click();
    await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  }

  await order('/onde-onde', 'Add one Tilapia pesmol', ondeName);
  await order('/dapur-demo', 'Add one Iced sweet tea', demoName);

  // Dapur Demo has its own items and, in dev, the sample pictures.
  await page.goto('/dapur-demo');
  await expect(page.getByRole('heading', { name: 'Dapur Demo' })).toBeVisible();
  await expect(page.getByText('Chicken soto')).toBeVisible();
  await expect(page.getByText('Tilapia pesmol')).toHaveCount(0);
  await expect(page.getByText('Kitchen photo')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Dapur Demo/ }).first()).toBeVisible();
  // The Menu tab remembers the last seller menu this phone visited.
  await page.goto('/settings');
  await expect(
    page.getByRole('navigation', { name: 'Customer' }).getByRole('link', { name: 'Menu' }),
  ).toHaveAttribute('href', '/dapur-demo');

  // My orders: one list, each card names its seller.
  await page.goto('/my-orders');
  await expect(page.getByText('Current orders').first()).toBeVisible();
  const ondeCard = page.getByRole('button', { name: /Onde Onde/ }).filter({ hasText: 'pesmol' });
  const demoCard = page.getByRole('button', { name: /Dapur Demo/ }).filter({ hasText: 'tea' });
  await expect(ondeCard.first()).toBeVisible();
  await expect(demoCard.first()).toBeVisible();
  await page.screenshot({ path: 'captures/multi-seller-my-orders.png', fullPage: true });

  expect(errors).toEqual([]);

  // An unknown seller link: a friendly page, the tab bar still there. (The browser logs the
  // server's 404 itself, so console errors are checked before this step.)
  await page.goto('/no-such-kitchen');
  await expect(page.getByRole('heading', { name: "We couldn't find this kitchen" })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Customer' })).toBeVisible();
  // The home page: no list of sellers.
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: "ShaggyBobo's Order · Weekly home-cooked orders" }),
  ).toBeVisible();
  await expect(page.getByText("Open your seller's link from WhatsApp.")).toBeVisible();
  await expect(page.getByText('Dapur Demo')).toHaveCount(0);

  // Seller side (a desktop device): Onde Onde by default, then Dapur Demo through the picker.
  const device = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1280, height: 800 },
  });
  try {
    const seller: Page = await device.newPage();
    const sellerErrors = collectErrors(seller);
    await seller.goto('/seller');
    await expect(seller.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
    await searchBox(seller).fill(ondeName);
    await expect(orderRow(seller, new RegExp(ondeName))).toBeVisible();
    await searchBox(seller).fill(demoName);
    await expect(orderRow(seller, new RegExp(demoName))).toHaveCount(0);

    await seller.getByLabel('Seller (dev only)').selectOption('dapur-demo');
    await expect(seller.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
    await expect(seller.getByLabel('Seller (dev only)')).toHaveValue('dapur-demo');
    await searchBox(seller).fill(demoName);
    await expect(orderRow(seller, new RegExp(demoName))).toBeVisible();
    await searchBox(seller).fill(ondeName);
    await expect(orderRow(seller, new RegExp(ondeName))).toHaveCount(0);
    await seller.screenshot({ path: 'captures/multi-seller-seller-dapur-demo.png' });
    expect(sellerErrors).toEqual([]);
  } finally {
    await device.close();
  }
});
