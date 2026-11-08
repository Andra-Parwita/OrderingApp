import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { addDays } from '../shared/dates';
import { markHowItWorksSeen } from './customerHelpers';
import { collectErrors } from './sellerHelpers';

// Plan 126: delivery on another day. The seller offers extra delivery days, the customer picks one at
// checkout, the seller sees the day tag. It changes Onde Onde's menu (and puts it back), so it runs
// with the isolated specs. Captures go to scratch/cap-126 (tablet 1280x800, phone 412x915).

const SELLER = 'onde-onde';
const HEADERS = { 'X-Seller': SELLER };
const SHOTS = 'scratch/cap-126';
const NOTE = { en: 'Delivery after 1 pm', id: 'Antar setelah jam 1' };

test.describe.configure({ mode: 'serial' });

type MenuReply = {
  menu: { menu: { cookingDate: string; delivery: { available: boolean; note: typeof NOTE } } };
};

let cooking = '';
let original: MenuReply['menu']['menu']['delivery'] | null = null;
const names = { event: '', next: '', before: '' };
let nextToken = '';

async function menuNow(request: APIRequestContext): Promise<MenuReply['menu']['menu']> {
  const reply = (await (
    await request.get('/api/seller/menus/current', { headers: HEADERS })
  ).json()) as MenuReply;
  return reply.menu.menu;
}

async function seller(page: Page) {
  await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
}

async function sellerOrder(
  request: APIRequestContext,
  firstName: string,
  fulfilment: 'delivery' | 'pickup',
  handoverDate?: string,
) {
  const dishes = (await (
    await request.get('/api/seller/menus/current', { headers: HEADERS })
  ).json()) as { menu: { dishes: Array<{ id: string }> } };
  const itemId = dishes.menu.dishes[0]?.id ?? '';
  const made = await request.post('/api/seller/orders', {
    headers: HEADERS,
    data: {
      firstName,
      language: 'en',
      fulfilment,
      lines: [{ itemId, qty: 2 }],
      ...(handoverDate ? { handoverDate } : {}),
    },
  });
  expect(made.ok(), await made.text()).toBe(true);
  return (await made.json()) as { order: { token: string; code: string } };
}

test.beforeAll(async ({ request }) => {
  const menu = await menuNow(request);
  cooking = menu.cookingDate;
  original = menu.delivery;
  const set = await request.put('/api/seller/menus/current', {
    headers: HEADERS,
    data: {
      delivery: {
        available: true,
        note: NOTE,
        days: [addDays(cooking, -1), cooking, addDays(cooking, 1)],
      },
    },
  });
  expect(set.ok(), await set.text()).toBe(true);
  const stamp = Date.now().toString(36).slice(-4);
  names.event = `Ayu${stamp}`;
  names.next = `Wayan${stamp}`;
  names.before = `Lenny${stamp}`;
  await sellerOrder(request, names.event, 'delivery');
  nextToken = (await sellerOrder(request, names.next, 'delivery', addDays(cooking, 1))).order.token;
  await sellerOrder(request, names.before, 'delivery', addDays(cooking, -1));
  await sellerOrder(request, `Pick${stamp}`, 'pickup');
});

test.afterAll(async ({ request }) => {
  if (!original) return;
  await request.put('/api/seller/menus/current', {
    headers: HEADERS,
    data: { delivery: { ...original, days: [] }, finishExtraDay: false },
  });
});

test.describe('tablet 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Details: the strip, the locked default and its sheet, keep open', async ({ page }) => {
    const errors = collectErrors(page);
    await seller(page);
    await page.goto('/seller/menu/edit/details');
    await expect(page.getByText('Delivery days', { exact: true })).toBeVisible();
    await page.getByText('Delivery days', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/details-tablet.png` });
    await page.getByRole('button', { name: /🔒/ }).click();
    await expect(page.getByRole('dialog', { name: 'Default delivery day' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/details-default-sheet-tablet.png` });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Keep the menu open 1 more day' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Details at 800x1280 (tablet upright): all four chips on one row', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1280 });
    await seller(page);
    await page.goto('/seller/menu/edit/details');
    const chips = page.getByRole('group', { name: 'Delivery days' }).getByRole('button');
    await expect(chips).toHaveCount(4);
    const ys = await chips.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().y)),
    );
    expect(new Set(ys).size).toBe(1);
    await page.getByText('Delivery days', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/details-portrait-tablet.png` });
  });

  test('Details in the new-menu wizard', async ({ page, request }) => {
    const un = await request.post('/api/seller/menus/current/unpublish', { headers: HEADERS });
    expect(un.ok(), await un.text()).toBe(true);
    try {
      await seller(page);
      await page.goto('/seller/menu');
      await page
        .getByRole('tab', { name: /Details/ })
        .or(page.getByRole('button', { name: /^Details$/ }))
        .first()
        .click();
      await page.getByRole('button', { name: 'Edit details' }).click();
      const chips = page.getByRole('group', { name: 'Delivery days' }).getByRole('button');
      await expect(chips).toHaveCount(4);
      const ys = await chips.evaluateAll((els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().y)),
      );
      expect(new Set(ys).size).toBe(1);
      await page.getByText('Delivery days', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/details-wizard-tablet.png` });
      await page.setViewportSize({ width: 800, height: 1280 });
      await page.getByText('Delivery days', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/details-wizard-portrait-tablet.png` });
    } finally {
      await request.post('/api/seller/menus/current/publish', { headers: HEADERS, data: {} });
    }
  });

  test('Orders and labels show the day tag only on another day', async ({ page }) => {
    await seller(page);
    await page.goto('/seller/orders');
    const next = page.getByRole('button', { name: new RegExp(names.next) }).first();
    await expect(next).toBeVisible();
    await expect(next).toContainText(/Mon|Sun|Tue|Sat|Fri|Thu|Wed/);
    const event = page.getByRole('button', { name: new RegExp(names.event) }).first();
    await expect(event).not.toContainText(addDays(cooking, 0).slice(8).replace(/^0/, ''));
    await page.screenshot({ path: `${SHOTS}/orders-tablet.png`, fullPage: true });
    await next.click();
    await expect(page.getByRole('button', { name: 'Change pickup or delivery' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/order-detail-tablet.png`, fullPage: true });
    await page.getByRole('button', { name: 'Change pickup or delivery' }).click();
    await expect(page.getByText('Delivery day', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/change-sheet-tablet.png` });
    // Only the day changes: the preview names the new day.
    const sheet = page.getByRole('dialog', { name: 'Change pickup or delivery' });
    await sheet.getByRole('radio', { name: /Sat 14/ }).click();
    await expect(sheet.getByText(/Your delivery day is now Sat 14 Nov\./)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/final-change-sheet-day-tablet.png` });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto('/seller/labels');
    await expect(
      page.getByText(new RegExp(`Delivery · .*${names.next}|${names.next}`)).first(),
    ).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/labels-tablet.png`, fullPage: true });
    await page.goto('/seller/orders');
    await page.getByRole('button', { name: 'New order' }).click();
    await page.locator('#new-order-how').selectOption('delivery');
    await expect(page.getByRole('radio', { name: /Fri 13 Nov/ })).toBeVisible();
    await page.waitForTimeout(700); // the panel slides in
    await page.getByRole('radio', { name: /Fri 13 Nov/ }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/new-order-tablet.png` });
  });

  test('Pickup & delivery lists deliveries by day', async ({ page }) => {
    await seller(page);
    await page.goto('/seller/hand-over');
    await expect(page.getByText(names.before).first()).toBeVisible();
    const order = await page.locator('body').innerText();
    expect(order.indexOf(names.before)).toBeLessThan(order.indexOf(names.event));
    expect(order.indexOf(names.event)).toBeLessThan(order.indexOf(names.next));
    await page.screenshot({ path: `${SHOTS}/hand-over-tablet.png`, fullPage: true });
  });
});

test.describe('phone 412x915', () => {
  test.use({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  test('customer picks a delivery day and sees it on Order placed', async ({ page, context }) => {
    const errors = collectErrors(page);
    await markHowItWorksSeen(context);
    const first = `Cust${Date.now().toString(36).slice(-5)}`;
    await page.goto('/onde-onde/dishes');
    await page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
    await page.getByRole('button', { name: /View basket/ }).click();
    await page.getByRole('radio', { name: 'Delivery' }).click();
    await expect(page.getByText('Delivery day', { exact: true })).toBeVisible();
    const days = page.getByRole('radiogroup').last().getByRole('radio');
    await expect(days).toHaveCount(3);
    await expect(days.nth(1)).toHaveAttribute('aria-checked', 'true'); // the event day
    // The row sits right under the Pickup / Delivery switch, above the address, on the first screen.
    const rowTop = (await days.first().boundingBox())?.y ?? 9999;
    const streetTop = (await page.getByLabel('Street number and name').boundingBox())?.y ?? 0;
    expect(rowTop).toBeLessThan(915);
    expect(rowTop).toBeLessThan(streetTop);
    await page.screenshot({ path: `${SHOTS}/checkout-phone.png` });
    await days.nth(2).click();
    await page
      .getByLabel('Street number and name')
      .fill('12 Jetty Rd')
      .catch(() => undefined);
    await page
      .getByLabel('Suburb')
      .fill('Glenelg')
      .catch(() => undefined);
    await page
      .getByLabel('Postcode')
      .fill('5045')
      .catch(() => undefined);
    await page.getByRole('button', { name: /Next: your name/ }).click();
    await expect(page.getByText(/Delivery .* to 12 Jetty Rd/)).toBeVisible();
    await page.waitForTimeout(900); // the page slides in
    await page.screenshot({ path: `${SHOTS}/final-checkout-name-phone.png` });
    await page.getByLabel('First name').fill(first);
    await page.getByRole('button', { name: /^Place order/ }).click();
    await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
    await expect(page.getByText(`Delivery on ${await dayText(addDays(cooking, 1))}`)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/placed-phone.png`, fullPage: true });
    await page.getByRole('button', { name: /View order details/ }).click();
    await expect(page.getByText(await dayText(addDays(cooking, 1))).first()).toBeVisible();
    await expect(page.getByText('Your order').first()).toBeVisible();
    await page.waitForTimeout(900); // the page slides in
    await page.screenshot({ path: `${SHOTS}/order-page-phone.png`, fullPage: true });
    expect(errors).toEqual([]);
  });

  test('seller phone: order list, label and New order', async ({ page }) => {
    await seller(page);
    await page.goto('/seller/orders');
    await expect(page.getByRole('button', { name: new RegExp(names.next) }).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/orders-phone.png`, fullPage: true });
    await page.goto('/seller/labels');
    await expect(page.getByText(names.next).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/labels-phone.png`, fullPage: true });
    await page.goto('/seller/orders');
    await page.getByRole('button', { name: 'New order' }).click();
    await page.locator('#new-order-how').selectOption('delivery');
    const chip = page.getByRole('radio', { name: /Fri 13 Nov/ });
    await expect(chip).toBeVisible();
    await chip.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${SHOTS}/new-order-phone.png` });
    await page.goto(`/o/${nextToken}`);
    await expect(page.getByText(await dayText(addDays(cooking, 1))).first()).toBeVisible();
    await expect(page.getByText('Your order').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/customer-order-phone.png`, fullPage: true });
  });
});

async function dayText(date: string): Promise<string> {
  const { formatCookingDate } = await import('../shared/dates');
  return formatCookingDate(date, 'en');
}
