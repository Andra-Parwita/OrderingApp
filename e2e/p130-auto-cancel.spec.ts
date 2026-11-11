import { expect, test, type Page } from '@playwright/test';
import { AUTO_CANCEL_SINCE } from '../shared/autoCancel';
import { markHowItWorksSeen } from './customerHelpers';

// Plan 130 captures: the seller's "Cancels at" tag, the cancelled-by-the-app panel with Restore,
// and the customer's order page. The 24-hour clock cannot be waited for, so the answers of the
// order list are changed in the browser (createdAt 22.5 h ago; then cancelled with the audit entry).
// The rule itself is proven in mocks/autoCancel.test.ts. Pictures go to scratch/cap-130/.
test.describe.configure({ mode: 'serial' });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one project, viewports set below');
});

const SELLER = 'onde-onde';
const SELLER_SIZES = [
  { name: 'tablet', width: 1280, height: 800, big: false },
  { name: 'phone', width: 412, height: 915, big: false },
] as const;
const CUSTOMER_SIZES = [
  { name: 'iphone', width: 390, height: 844, big: false },
  { name: 'small-125', width: 360, height: 780, big: true },
] as const;

type Order = Record<string, unknown> & { code: string; token: string };

async function shoot(
  page: Page,
  lang: string,
  screen: string,
  sizes: ReadonlyArray<{ name: string; width: number; height: number; big: boolean }>,
) {
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.addStyleTag({
      content: `html { font-size: ${size.big ? '125%' : '100%'} !important; }`,
    });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      size.width,
    );
    await page.screenshot({
      path: `scratch/cap-130/${lang}-${screen}-${size.name}.png`,
      fullPage: size.width < 800,
    });
  }
}

async function place(page: Page): Promise<Order> {
  const dishes = (await (await page.request.get('/api/s/onde-onde/menu')).json()) as {
    items: Array<{ id: string }>;
  };
  const made = await page.request.post('/api/s/onde-onde/orders', {
    data: {
      firstName: `Effi${String(Date.now()).slice(-4)}`,
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: dishes.items[0]?.id ?? '', qty: 1 }],
    },
  });
  expect(made.ok(), await made.text()).toBe(true);
  return ((await made.json()) as { order: Order }).order;
}

// The rule counts from the later of the order's time and AUTO_CANCEL_SINCE, so the order is dated
// after that and the browser clock is set 22.5 h later (inside the last 2 hours).
const PLACED_AT = new Date(Date.parse(AUTO_CANCEL_SINCE) + 2 * 3_600_000);
const NOW_IN_WINDOW = new Date(PLACED_AT.getTime() + 22.5 * 3_600_000);

async function sellerSees(page: Page, code: string, change: (order: Order) => Order) {
  await page.route(/\/api\/seller\/orders(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { orders: Array<Order> };
    body.orders = body.orders.map((order) => (order.code === code ? change(order) : order));
    await route.fulfill({ response, json: body });
  });
}

test('seller: the tag in the last 2 hours, the cancelled panel with Restore (EN + ID)', async ({
  page,
}) => {
  const order = await place(page);
  await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
  await page.clock.setFixedTime(NOW_IN_WINDOW);
  await sellerSees(page, order.code, (o) => ({ ...o, createdAt: PLACED_AT.toISOString() }));
  await page.goto('/seller/orders');
  const row = page.locator(`[data-row-id="${order.code}"]`).first();
  await expect(row).toContainText('Cancels at');
  await shoot(page, 'en', 'seller-tag', SELLER_SIZES);

  await page.unroute(/\/api\/seller\/orders(\?.*)?$/);
  await sellerSees(page, order.code, (o) => ({
    ...o,
    status: 'cancelled',
    audit: [
      {
        by: { role: 'seller', name: 'App' },
        what: 'status',
        detail: 'not_confirmed_24h',
        at: new Date().toISOString(),
      },
    ],
  }));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/seller/orders/${order.code}`);
  await expect(page.getByText(/^Cancelled by the app at /)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore order' })).toBeVisible();
  await shoot(page, 'en', 'seller-cancelled', SELLER_SIZES);

  await page.evaluate(() => localStorage.setItem('lang', 'id'));
  await page.goto(`/seller/orders/${order.code}`);
  await expect(page.getByRole('button', { name: 'Pulihkan pesanan' })).toBeVisible();
  await shoot(page, 'id', 'seller-cancelled', SELLER_SIZES);
  await page.unroute(/\/api\/seller\/orders(\?.*)?$/);
  await sellerSees(page, order.code, (o) => ({ ...o, createdAt: PLACED_AT.toISOString() }));
  await page.goto('/seller/orders');
  await expect(page.locator(`[data-row-id="${order.code}"]`).first()).toContainText(
    'Dibatalkan pukul',
  );
  await shoot(page, 'id', 'seller-tag', SELLER_SIZES);
  await page.evaluate(() => localStorage.setItem('lang', 'en'));
});

test('customer: the order page of an order the app cancelled (EN + ID)', async ({
  page,
  context,
}) => {
  await markHowItWorksSeen(context);
  const order = await place(page);
  const cancelled = (o: Order) => ({
    ...o,
    status: 'cancelled',
    inbox: [
      ...((o['inbox'] as Array<unknown>) ?? []),
      { at: new Date().toISOString(), kind: 'status', status: 'cancelled' },
      { at: new Date().toISOString(), kind: 'message', textKey: 'autoCancelled' },
    ],
  });
  await page.route(/\/api\/orders\/[^/?]+$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { order: Order };
    await route.fulfill({ response, json: { order: cancelled(body.order) } });
  });
  await page.route(/\/api\/orders\?tokens=/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { orders: Array<Order> };
    await route.fulfill({
      response,
      json: {
        ...body,
        orders: body.orders.map((o) => (o.token === order.token ? cancelled(o) : o)),
      },
    });
  });
  await page.addInitScript(
    ([code, token]) =>
      localStorage.setItem(
        'myOrders',
        JSON.stringify([
          { code, token, placedAt: new Date().toISOString(), sellerSlug: 'onde-onde' },
        ]),
      ),
    [order.code, order.token],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/onde-onde/o/${order.token}`);
  await expect(page.getByTestId('auto-cancelled')).toContainText('within 24 hours');
  await expect(page.getByTestId('wa-reminder')).toHaveCount(0);
  await shoot(page, 'en', 'customer-order', CUSTOMER_SIZES);
  await page.goto('/onde-onde/my-orders');
  await expect(page.getByText('Cancelled').first()).toBeVisible();
  await shoot(page, 'en', 'customer-my-orders', CUSTOMER_SIZES);
  await page.evaluate(() => localStorage.setItem('lang', 'id'));
  await page.goto(`/onde-onde/o/${order.token}`);
  await expect(page.getByTestId('auto-cancelled')).toContainText('dalam 24 jam');
  await shoot(page, 'id', 'customer-order', CUSTOMER_SIZES);
});
