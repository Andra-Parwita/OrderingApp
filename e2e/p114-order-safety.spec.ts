import { expect, test, type Page } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';

// Plan 114: a customer must never be unable to order, and never double-ordered by accident.
// Four situations on /onde-onde, each with a unique first name; the seller API (no login on the
// dev server) counts the orders. The shared store is never reset.
test.use({ viewport: { width: 390, height: 844 } });
// One at a time: the timing check (no wait on the 4.5 s slow-link timer) needs an unloaded dev server.
test.describe.configure({ mode: 'serial' });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'mobile-chromium', 'phone only');
});

const ORDERS = '**/api/s/onde-onde/orders';
const unique = (tag: string): string => `${tag}-${Date.now()}`;

async function fillAndReachName(page: Page, firstName: string): Promise<void> {
  await page.goto('/onde-onde/dishes');
  await page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
  await page.getByRole('button', { name: /View basket/ }).click();
  await page.getByRole('radio', { name: 'Pickup' }).click();
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await page.getByLabel('First name').fill(firstName);
}

const placeButton = (page: Page) => page.getByRole('button', { name: /^Place order/ });
const failure = (page: Page) => page.getByText(/Could not place your order/);

async function placeAndLand(page: Page, firstName: string): Promise<string> {
  await fillAndReachName(page, firstName);
  await placeButton(page).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  return /\/o\/([^/]+)\/placed$/.exec(page.url())?.[1] ?? '';
}

async function ordersOf(page: Page, firstName: string) {
  const response = await page.request.get('/api/seller/orders');
  const { orders } = (await response.json()) as {
    orders: Array<{ code: string; firstName: string; status: string }>;
  };
  return orders.filter((o) => o.firstName === firstName);
}

test('a lost answer: the quiet re-send lands the first order, not a second one', async ({
  page,
  context,
}) => {
  await markHowItWorksSeen(context);
  const firstName = unique('Lost');
  let sent = 0;
  await page.route(ORDERS, async (route) => {
    if (route.request().method() === 'POST' && sent++ === 0) {
      await route.fetch(); // the server makes the order...
      await route.abort('connectionreset'); // ...but the phone never hears
      return;
    }
    await route.continue();
  });
  await fillAndReachName(page, firstName);
  await placeButton(page).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  expect(sent).toBe(2);
  expect(await ordersOf(page, firstName)).toHaveLength(1);
});

test('two lost answers in a row: the failure shows, the tap after it opens the one order', async ({
  page,
  context,
}) => {
  await markHowItWorksSeen(context);
  const firstName = unique('Lost2');
  let sent = 0;
  await page.route(ORDERS, async (route) => {
    if (route.request().method() === 'POST' && sent++ < 2) {
      await route.fetch();
      await route.abort('connectionreset');
      return;
    }
    await route.continue();
  });
  await fillAndReachName(page, firstName);
  await placeButton(page).click();
  await expect(failure(page)).toBeVisible();
  await placeButton(page).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  expect(await ordersOf(page, firstName)).toHaveLength(1);
});

test('cancelled, then the same basket again: a new order', async ({ page, context }) => {
  await markHowItWorksSeen(context);
  const firstName = unique('Cancel');
  await placeAndLand(page, firstName);
  const [firstOrder] = await ordersOf(page, firstName);
  const done = await page.request.post(`/api/seller/orders/${firstOrder?.code ?? ''}/status`, {
    data: { to: 'cancelled' },
  });
  expect(done.ok()).toBe(true);
  await placeAndLand(page, firstName);
  const all = await ordersOf(page, firstName);
  expect(all).toHaveLength(2);
  expect(new Set(all.map((o) => o.code)).size).toBe(2);
  expect(all.filter((o) => o.status !== 'cancelled')).toHaveLength(1);
});

test('the same basket on purpose after success: two orders', async ({ page, context }) => {
  await markHowItWorksSeen(context);
  const firstName = unique('Twice');
  await placeAndLand(page, firstName);
  await placeAndLand(page, firstName);
  const all = await ordersOf(page, firstName);
  expect(all).toHaveLength(2);
  expect(new Set(all.map((o) => o.code)).size).toBe(2);
});

test('a hung request: the failure shows within the timeouts, the tap after it makes one order', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await markHowItWorksSeen(context);
  const firstName = unique('Hang');
  let sent = 0;
  await page.route(ORDERS, async (route) => {
    if (route.request().method() === 'POST' && sent++ < 2) return; // never answered
    await route.continue();
  });
  await fillAndReachName(page, firstName);
  await placeButton(page).click();
  // 45 s for the try and 45 s for the quiet re-send (owner, 21 Oct: a slow save must not look failed).
  await expect(failure(page)).toBeVisible({ timeout: 100_000 });
  await placeButton(page).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  expect(await ordersOf(page, firstName)).toHaveLength(1);
});

test('on a normal network: one request, no re-send, no waiting on the slow-link timer', async ({
  page,
  context,
}) => {
  await markHowItWorksSeen(context);
  const firstName = unique('Fast');
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/s/onde-onde/orders')) posts.push(r.url());
  });
  // The menu comes from the network with no 4.5 s wait (the service worker's slow-link timer).
  await page.goto('/onde-onde/dishes'); // warms the dev server's first compile
  await page.goto('/onde-onde/dishes');
  await expect(page.getByRole('button', { name: 'Add one Tilapia pesmol' })).toBeVisible();
  // Not wall-clock for the whole render (that grows under a loaded machine): the browser's own
  // timing of the page and the menu answer. The slow-link timer would put them at 4.5 s or more.
  const waited = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const menu = (performance.getEntriesByType('resource') as Array<PerformanceResourceTiming>)
      .filter((e) => e.name.includes('/api/') && e.name.includes('/menu'))
      .map((e) => e.responseEnd - e.startTime);
    return { page: nav.responseStart, menu };
  });
  expect(waited.page).toBeLessThan(4400);
  for (const ms of waited.menu) expect(ms).toBeLessThan(4400);
  await fillAndReachName(page, firstName);
  const tapped = Date.now();
  await placeButton(page).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  expect(Date.now() - tapped).toBeLessThan(5000);
  // Give any stray automatic re-send time to show itself.
  await page.waitForTimeout(1500);
  expect(posts).toHaveLength(1);
  expect(await ordersOf(page, firstName)).toHaveLength(1);
});
