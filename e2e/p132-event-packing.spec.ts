import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';

// Plan 132 (packing at the event) and plan 131 (keep open by default). One flow test checks the pack sheet
// end to end on the tablet (ticks send nothing until Save, Ready anyway, delivery says Packed, Kitchen ->
// Pack Ready & next bag, the Menu defaults switch); the capture tests save the changed seller screens at
// phone and tablet sizes and at larger text to scratch/cap-132 for the coordinator to look at. Orders are
// placed through the seller API (its own names), so no wall-clock cut-off matters (the seller can always
// order and pack). Runs on desktop-chromium only; the phone and tablet sizes are set here.
test.describe.configure({ mode: 'serial' });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one project, sizes set below');
});
test.setTimeout(180_000);

const SELLER = 'onde-onde';
const HEADERS = { 'X-Seller': SELLER };
const SHOTS = 'scratch/cap-132';
const ORIGIN = 'https://localhost:5181';
const UNLIMITED = ['nasi-campur', 'pesmol', 'ayam-goreng', 'tempe-mendoan'];
const MONEY = /\$\s?\d/;

type Made = { code: string; name: string; lines: number };
const orders = {} as { a: Made; b: Made; c: Made; d: Made };

type Config = {
  name: string;
  width: number;
  height: number;
  phone: boolean;
  font: 100 | 125 | 150;
};
const CONFIGS: ReadonlyArray<Config> = [
  { name: '412x915', width: 412, height: 915, phone: true, font: 100 },
  { name: '412x915-t125', width: 412, height: 915, phone: true, font: 125 },
  { name: '412x915-t150', width: 412, height: 915, phone: true, font: 150 },
  { name: '1280x800', width: 1280, height: 800, phone: false, font: 100 },
  { name: '1280x800-t125', width: 1280, height: 800, phone: false, font: 125 },
  { name: '1280x800-t150', width: 1280, height: 800, phone: false, font: 150 },
  { name: '1126x800', width: 1126, height: 800, phone: false, font: 100 },
  { name: '800x1280', width: 800, height: 1280, phone: false, font: 100 },
];

async function seller(browser: Browser, cfg: Config): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    deviceScaleFactor: 2,
    isMobile: cfg.phone,
    hasTouch: true,
    timezoneId: 'Australia/Adelaide',
    baseURL: ORIGIN,
    extraHTTPHeaders: { Origin: ORIGIN },
  });
  const page = await context.newPage();
  await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
  await page.addInitScript((font) => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.fontSize = `${String(font)}%`;
    });
  }, cfg.font);
  return page;
}

type ApiOrder = { code: string; status: string; packed?: boolean; paid: boolean };

async function makeOrder(
  request: APIRequestContext,
  itemIds: ReadonlyArray<string>,
  firstName: string,
  fulfilment: 'pickup' | 'delivery',
  paid: boolean,
): Promise<Made> {
  const made = await request.post('/api/seller/orders', {
    headers: HEADERS,
    data: {
      firstName,
      language: 'en',
      fulfilment,
      lines: itemIds.map((itemId) => ({ itemId, qty: 1 })),
    },
  });
  expect(made.ok(), await made.text()).toBe(true);
  const { order } = (await made.json()) as { order: ApiOrder };
  if (order.status !== 'confirmed') {
    const moved = await request.post(`/api/seller/orders/${order.code}/status`, {
      headers: HEADERS,
      data: { to: 'confirmed' },
    });
    expect(moved.ok(), await moved.text()).toBe(true);
  }
  if (paid) {
    const set = await request.post(`/api/seller/orders/${order.code}/paid`, {
      headers: HEADERS,
      data: { paid: true },
    });
    expect(set.ok(), await set.text()).toBe(true);
  }
  return { code: order.code, name: firstName, lines: itemIds.length };
}

async function serverOrder(request: APIRequestContext, code: string): Promise<ApiOrder> {
  const reply = (await (await request.get('/api/seller/orders', { headers: HEADERS })).json()) as {
    orders: Array<ApiOrder>;
  };
  const found = reply.orders.find((order) => order.code === code);
  expect(found, `order ${code} in the list`).toBeDefined();
  return found as ApiOrder;
}

test.beforeAll(async ({ request }) => {
  const menu = (await (
    await request.get('/api/seller/menus/current', { headers: HEADERS })
  ).json()) as { menu: { dishes: Array<{ id: string }> } };
  const ids = menu.menu.dishes.map((dish) => dish.id).filter((id) => UNLIMITED.includes(id));
  expect(ids.length).toBeGreaterThanOrEqual(3);
  const stamp = Date.now().toString(36).slice(-4);
  orders.a = await makeOrder(request, ids.slice(0, 3), `Packa${stamp}`, 'pickup', false);
  orders.b = await makeOrder(request, ids.slice(0, 2), `Packb${stamp}`, 'pickup', true);
  orders.c = await makeOrder(request, ids.slice(0, 2), `Packc${stamp}`, 'delivery', false);
  // D is only for the captures: unpaid pickup with one line already ticked and saved.
  orders.d = await makeOrder(request, ids.slice(0, 3), `Packd${stamp}`, 'pickup', false);
  const ticked = await request.post(`/api/seller/orders/${orders.d.code}/pack`, {
    headers: HEADERS,
    data: { ticked: ids.slice(0, 1) },
  });
  expect(ticked.ok(), await ticked.text()).toBe(true);
});

const row = (page: Page, made: Made): Locator =>
  page.locator(`[data-row-id="${made.code}"]`).first();
const sheet = (page: Page): Locator => page.getByRole('dialog', { name: 'Pack', exact: true });
const spill = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** Pack requests (POST to /api/seller/orders/CODE/pack) seen by the page, with their bodies. */
function watchPack(page: Page): Array<{ ticked: Array<string> }> {
  const seen: Array<{ ticked: Array<string> }> = [];
  page.on('request', (request) => {
    if (request.method() === 'GET' || !/\/api\/seller\/orders\/[^/]+\/pack/.test(request.url())) {
      return;
    }
    seen.push(request.postDataJSON() as { ticked: Array<string> });
  });
  return seen;
}

test('flow: totals, Paid tags, the pack sheet saves only on its buttons, ready, delivery, Kitchen, defaults', async ({
  browser,
  request,
}) => {
  const page = await seller(browser, CONFIGS[3] as Config);
  const sent = watchPack(page);
  const { a, b, c } = orders;

  // 2. Orders list: total, Paid / Not paid, "0 of N packed".
  await page.goto('/seller/orders');
  await expect(row(page, a)).toBeVisible();
  await expect(row(page, a)).toContainText(MONEY);
  await expect(row(page, a)).toContainText('Not paid');
  await expect(row(page, a)).toContainText('0 of 3 packed');
  await expect(row(page, b)).toContainText('Paid');
  await expect(row(page, b)).not.toContainText('Not paid');
  await expect(row(page, b)).toContainText('0 of 2 packed');
  await expect(row(page, c)).toContainText('Not paid');
  await expect(row(page, c)).toContainText('0 of 2 packed');

  // 3. Order A: pinned header, the sheet, ticks send nothing, Save sends once, ticks are kept.
  await page.goto(`/seller/orders/${a.code}`);
  const head = page.getByRole('heading', { name: new RegExp(a.name) }).locator('xpath=../..');
  await expect(head).toContainText(MONEY);
  await expect(head).toContainText('Not paid');
  await page.getByRole('button', { name: 'Pack · 0 of 3' }).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page)).toContainText('0 of 3 ticked');
  const boxes = sheet(page).getByRole('checkbox');
  await boxes.nth(0).click();
  await boxes.nth(1).click();
  await expect(boxes.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(sheet(page)).toContainText('2 of 3 ticked');
  await page.waitForTimeout(600);
  expect(sent).toHaveLength(0);
  await sheet(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet(page)).toBeHidden();
  expect(sent).toHaveLength(1);
  expect(sent[0]?.ticked).toHaveLength(2);
  await page.getByRole('button', { name: 'Pack · 2 of 3' }).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole('checkbox').nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(sheet(page).getByRole('checkbox').nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(sheet(page).getByRole('checkbox').nth(2)).toHaveAttribute('aria-checked', 'false');

  // 4. Ready with one line unticked asks, then Ready anyway packs and moves to Ready for pickup.
  await sheet(page).getByRole('button', { name: 'Ready for pickup', exact: true }).click();
  const ask = page.getByRole('alertdialog', { name: '1 item not ticked. Ready anyway?' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Ready anyway' }).click();
  await expect(sheet(page)).toBeHidden();
  await expect
    .poll(async () => (await serverOrder(request, a.code)).status)
    .toBe('ready_for_pickup');
  expect((await serverOrder(request, a.code)).packed).toBe(true);

  // 6. Kitchen -> Pack: rows with total + Paid tag; tick bag B, Ready & next bag opens another bag.
  await page.goto('/seller/cook?tab=pack');
  const bagB = page.getByRole('button', { name: new RegExp(b.name) });
  await expect(bagB).toBeVisible();
  await expect(bagB).toContainText(MONEY);
  await expect(bagB).toContainText('Paid');
  await expect(bagB).not.toContainText('Not paid');
  await bagB.click();
  const open = page.getByLabel(new RegExp(`^${b.name} `));
  await expect(open).toBeVisible();
  for (let i = 0; i < b.lines; i += 1) await open.getByRole('checkbox').nth(i).click();
  await open.getByRole('button', { name: 'Ready & next bag' }).click();
  await expect(page.getByLabel(new RegExp(`^${b.name} `))).toBeHidden();
  await expect(page.getByRole('checkbox').first()).toBeVisible();
  await expect
    .poll(async () => (await serverOrder(request, b.code)).status)
    .toBe('ready_for_pickup');

  // 5. Delivery order C: the button reads "Packed"; the status stays Confirmed.
  await page.goto(`/seller/orders/${c.code}`);
  await page.getByRole('button', { name: 'Pack · 0 of 2' }).click();
  await expect(sheet(page)).toBeVisible();
  await expect(
    sheet(page).getByRole('button', { name: 'Ready for pickup', exact: true }),
  ).toHaveCount(0);
  for (let i = 0; i < c.lines; i += 1) await sheet(page).getByRole('checkbox').nth(i).click();
  await sheet(page).getByRole('button', { name: 'Packed', exact: true }).click();
  await expect(sheet(page)).toBeHidden();
  await expect.poll(async () => (await serverOrder(request, c.code)).packed).toBe(true);
  expect((await serverOrder(request, c.code)).status).toBe('confirmed');

  // 7. Settings -> Menu defaults: "Keep new menus open 1 more day" is on by default.
  await page.goto('/seller/settings/defaults');
  await expect(page.getByRole('switch', { name: 'Keep new menus open 1 more day' })).toBeChecked();
  await page.context().close();
});

for (const cfg of CONFIGS) {
  test(`captures at ${cfg.name}`, async ({ browser }) => {
    const page = await seller(browser, cfg);
    const shot = async (screen: string) => {
      await page.waitForTimeout(400); // slides and fonts settle
      expect.soft(await spill(page), `${screen} spills sideways`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SHOTS}/${cfg.name}-${screen}.png` });
    };
    const { d } = orders;

    // Order detail (a phone page; the tablet's panel beside the list), the pack sheet and the question.
    await page.goto(`/seller/orders/${d.code}`);
    await expect(page.getByRole('heading', { name: new RegExp(d.name) })).toBeVisible();
    await shot('order-detail');
    await page.getByRole('button', { name: /^Pack · 1 of 3/ }).click();
    await expect(sheet(page)).toBeVisible();
    await shot('pack-sheet');
    await sheet(page).getByRole('button', { name: 'Ready for pickup', exact: true }).click();
    await expect(
      page.getByRole('alertdialog', { name: '2 items not ticked. Ready anyway?' }),
    ).toBeVisible();
    await shot('pack-ask');
    await page.getByRole('button', { name: 'Back to packing' }).click();
    await sheet(page).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet(page)).toBeHidden();

    // Orders list.
    await page.goto('/seller/orders');
    await expect(row(page, d)).toBeVisible();
    await shot('orders-list');

    // Kitchen -> Pack with bag D open.
    await page.goto('/seller/cook?tab=pack');
    const bag = page.getByRole('button', { name: new RegExp(d.name) });
    await expect(bag).toBeVisible();
    if (cfg.phone) {
      // Phone: the list alone; a tapped bag opens in the full-screen pack sheet.
      await shot('kitchen-pack');
      await bag.click();
      await expect(sheet(page)).toBeVisible();
      await shot('kitchen-pack-bag');
      await sheet(page).getByRole('button', { name: 'Close', exact: true }).click();
      await expect(sheet(page)).toBeHidden();
    } else {
      await bag.click();
      await expect(page.getByLabel(new RegExp(`^${d.name} `))).toBeVisible();
      await shot('kitchen-pack');
    }

    // Pickup & delivery (the left-rail / phone tab item of that name).
    await page.goto('/seller/hand-over');
    await expect(page.getByText(orders.c.name).first()).toBeVisible();
    await shot('pickup-delivery');

    // The deliveries list. Only the delivery order (C) is on it; D is a pickup.
    await page.goto('/seller/deliveries');
    await expect(page.getByText(orders.c.name).first()).toBeVisible();
    await shot('deliveries');

    // Settings is an owner screen for the tablet only.
    if (!cfg.phone) {
      await page.goto('/seller/settings/defaults');
      await expect(
        page.getByRole('switch', { name: 'Keep new menus open 1 more day' }),
      ).toBeVisible();
      await shot('settings-menu-defaults');
    }
    await page.context().close();
  });
}
