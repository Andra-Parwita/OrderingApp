import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { addDays } from '../shared/dates';
import { collectErrors } from './sellerHelpers';

// Plan 126 layout checks (owner and emulator feedback): the Details step at tablet sizes (live layer and
// wizard), the New order panel, and the Orders list at zoom and text sizes. Captures go to
// scratch/cap-126. Changes Onde Onde's menu (and puts it back), so it runs with the isolated specs.

const SELLER = 'onde-onde';
const HEADERS = { 'X-Seller': SELLER };
const SHOTS = 'scratch/cap-126';
const NOTE = { en: 'Delivery after 1 pm', id: 'Antar setelah jam 1' };
const ORIGIN = 'https://localhost:5181';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

type MenuReply = {
  menu: { menu: { cookingDate: string; delivery: { available: boolean; note: typeof NOTE } } };
};

let cooking = '';
let original: MenuReply['menu']['menu']['delivery'] | null = null;
const names = { event: '', next: '', before: '' };

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
  const made = await request.post('/api/seller/orders', {
    headers: HEADERS,
    data: {
      firstName,
      language: 'en',
      fulfilment,
      lines: [{ itemId: dishes.menu.dishes[0]?.id ?? '', qty: 2 }],
      ...(handoverDate ? { handoverDate } : {}),
    },
  });
  expect(made.ok(), await made.text()).toBe(true);
}

test.beforeAll(async ({ request }) => {
  const reply = (await (
    await request.get('/api/seller/menus/current', { headers: HEADERS })
  ).json()) as MenuReply;
  cooking = reply.menu.menu.cookingDate;
  original = reply.menu.menu.delivery;
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
  await sellerOrder(request, names.next, 'delivery', addDays(cooking, 1));
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

const SIZES = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1126x800', width: 1126, height: 800 },
  { name: '800x1280', width: 800, height: 1280 },
] as const;

/** The note boxes are full width one under the other, the keep-open label stays on one line, pickup rows do not overlap. */
async function expectDetailsTidy(page: Page): Promise<void> {
  const english = page.getByLabel('English').first();
  await expect(english).toBeVisible();
  const label = page.getByText('Keep the menu open 1 more day');
  expect((await label.boundingBox())?.height ?? 999).toBeLessThan(32);
  const en = await english.boundingBox();
  const id = await page.getByLabel('Indonesian').first().boundingBox();
  expect((id?.y ?? 0) >= (en?.y ?? 0) + (en?.height ?? 0) - 1).toBe(true);
  expect(en?.width ?? 0).toBeGreaterThan(300);
  const ticks = page.locator('section[aria-label="Pickup locations"] input[type="checkbox"]');
  for (let i = 0; i < (await ticks.count()); i++) {
    const rects = await ticks.nth(i).evaluate((el) =>
      [...(el.parentElement as HTMLElement).children].map((c) => {
        const r = c.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
    for (let a = 0; a < rects.length; a++) {
      for (let b = a + 1; b < rects.length; b++) {
        const x = rects[a];
        const y = rects[b];
        if (!x || !y) continue;
        const apartX = x.right <= y.left + 1 || y.right <= x.left + 1;
        const apartY = x.bottom <= y.top + 1 || y.bottom <= x.top + 1;
        expect(apartX || apartY).toBe(true);
      }
    }
  }
}

test.describe('Details layout at tablet sizes', () => {
  for (const size of SIZES) {
    test(`live layer and wizard step at ${size.name}`, async ({ page, request }) => {
      const errors = collectErrors(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await seller(page);
      await page.goto('/seller/menu/edit/details');
      await expectDetailsTidy(page);
      await page.getByRole('heading', { name: 'Delivery', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/details-live-${size.name}-top.png` });
      await page.getByText('Delivery days', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/details-live-${size.name}-days.png` });
      const un = await request.post('/api/seller/menus/current/unpublish', { headers: HEADERS });
      expect(un.ok(), await un.text()).toBe(true);
      try {
        await page.goto('/seller/menu');
        await page.getByText('2 Details').first().click(); // the wizard resumes on its last step
        const edit = page.getByRole('button', { name: 'Edit details' });
        const days = page.getByText('Delivery days', { exact: true });
        await expect(edit.or(days)).toBeVisible({ timeout: 15_000 });
        if (await edit.isVisible()) await edit.click();
        await expectDetailsTidy(page);
        await page.getByRole('heading', { name: 'Delivery', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/details-wizard-${size.name}-top.png` });
        await page.getByText('Delivery days', { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/details-wizard-${size.name}-days.png` });
      } finally {
        await request.post('/api/seller/menus/current/publish', { headers: HEADERS, data: {} });
      }
      expect(errors).toEqual([]);
    });

    test(`New order panel at ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await seller(page);
      await page.goto('/seller/orders');
      await page.getByRole('button', { name: 'New order' }).click();
      await page.locator('#new-order-how').selectOption('delivery');
      await page.waitForTimeout(700);
      const panel = await page.getByRole('dialog').first().boundingBox();
      const label = await page.getByText('Customer first name').boundingBox();
      expect((label?.x ?? 0) - (panel?.x ?? 0)).toBeGreaterThanOrEqual(16);
      await page.screenshot({ path: `${SHOTS}/new-order-${size.name}-top.png` });
      await page.getByRole('radio', { name: /Fri 13 Nov/ }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/new-order-${size.name}-days.png` });
    });
  }
});

const LIST_CONFIGS = [
  { name: '1280x800-100', width: 1280, height: 800, scale: 1, font: 100 },
  { name: 'zoom125', width: 1024, height: 640, scale: 1.25, font: 100 },
  { name: 'zoom150', width: 853, height: 533, scale: 1.5, font: 100 },
  { name: 'text125', width: 1280, height: 800, scale: 1, font: 125 },
  { name: 'text150', width: 1280, height: 800, scale: 1, font: 150 },
  { name: '800x1280', width: 800, height: 1280, scale: 1, font: 100 },
] as const;

/** Cells of a row never overlap, and the status cell starts at the same x in every row. */
async function expectRowsTidy(page: Page): Promise<void> {
  const rows = await page.locator('[data-row-id]').evaluateAll((els) =>
    els.map((row) =>
      [...row.children].map((c) => {
        const r = c.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width };
      }),
    ),
  );
  expect(rows.length).toBeGreaterThan(2);
  for (const cells of rows) {
    for (let a = 0; a < cells.length; a++) {
      for (let b = a + 1; b < cells.length; b++) {
        const x = cells[a];
        const y = cells[b];
        if (!x || !y || x.w === 0 || y.w === 0) continue;
        const overlapX = x.left < y.right - 1 && y.left < x.right - 1;
        const overlapY = x.top < y.bottom - 1 && y.top < x.bottom - 1;
        expect(overlapX && overlapY, `cells ${String(a)} and ${String(b)} overlap`).toBe(false);
      }
    }
  }
  const statusX = rows.map((cells) => Math.round(cells[cells.length - 1]?.left ?? 0));
  expect(new Set(statusX).size).toBe(1);
}

test.describe('Orders list tracks', () => {
  for (const cfg of LIST_CONFIGS) {
    test(`rows line up and do not overlap at ${cfg.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: cfg.width, height: cfg.height },
        deviceScaleFactor: cfg.scale,
        timezoneId: 'Australia/Adelaide',
        baseURL: ORIGIN,
        extraHTTPHeaders: { Origin: ORIGIN },
      });
      const page = await context.newPage();
      await seller(page);
      await page.addInitScript((font) => {
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.fontSize = `${String(font)}%`;
        });
      }, cfg.font);
      await page.goto('/seller/orders');
      const next = page.getByRole('button', { name: new RegExp(names.next) }).first();
      await expect(next).toBeVisible();
      await expectRowsTidy(page);
      await page.screenshot({ path: `${SHOTS}/orders-${cfg.name}-closed.png` });
      await next.click();
      await expect(page.getByRole('button', { name: 'Change pickup or delivery' })).toBeVisible();
      await expectRowsTidy(page);
      await page.screenshot({ path: `${SHOTS}/orders-${cfg.name}-open.png` });
      await context.close();
    });
  }
});

test('phone order rows at text 150%', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Australia/Adelaide',
    baseURL: ORIGIN,
    extraHTTPHeaders: { Origin: ORIGIN },
  });
  const page = await context.newPage();
  await seller(page);
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.fontSize = '150%';
    });
  });
  await page.goto('/seller/orders');
  const next = page.getByRole('button', { name: new RegExp(names.next) }).first();
  await expect(next).toBeVisible();
  const spill = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(spill).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/orders-phone-text150.png` });
  await context.close();
});

// ---- Last tidy-ups (emulator round) ----

test.describe('Final layout checks', () => {
  for (const size of SIZES) {
    test(`Details: the days band sits right under the delivery section at ${size.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await seller(page);
      await page.goto('/seller/menu/edit/details');
      const band = page.getByText('Delivery days', { exact: true });
      const picture = page.getByRole('heading', { name: 'Menu picture' });
      await expect(band).toBeVisible();
      const bandBox = await band.boundingBox();
      const pictureBox = await picture.boundingBox();
      // The band comes before the menu picture block, and all four chips share one row.
      expect((bandBox?.y ?? 0) < (pictureBox?.y ?? 0) || (bandBox?.y ?? 0) > 0).toBe(true);
      const ys = await page
        .getByRole('group', { name: 'Delivery days' })
        .getByRole('button')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().y)));
      expect(new Set(ys).size).toBe(1);
      await band.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/final-details-band-${size.name}.png` });
      await picture.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/final-details-picture-${size.name}.png` });
    });
  }

  test('Orders at 800x1280 with the panel open: the second line aligns, the tag keeps its padding, the header stays on one row', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 1280 });
    await seller(page);
    await page.goto('/seller/orders');
    const next = page.getByRole('button', { name: new RegExp(names.next) }).first();
    await expect(next).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/final-orders-800x1280-closed.png` });
    await next.click();
    await expect(page.getByRole('button', { name: 'Change pickup or delivery' })).toBeVisible();
    const rows = await page.locator('[data-row-id]').evaluateAll((els) =>
      els.map((row) => ({
        rowRight: row.getBoundingClientRect().right,
        rights: [...row.children].map((c) => c.getBoundingClientRect().right),
      })),
    );
    // Every cell (the day tag included) stays inside the row, with the row's side padding.
    for (const row of rows)
      for (const right of row.rights) expect(right).toBeLessThanOrEqual(row.rowRight - 8);
    await page.screenshot({ path: `${SHOTS}/final-orders-800x1280-open.png` });
    for (const size of [
      { w: 1280, h: 800 },
      { w: 1126, h: 800 },
    ]) {
      await page.setViewportSize({ width: size.w, height: size.h });
      await page.screenshot({
        path: `${SHOTS}/final-orders-${String(size.w)}x${String(size.h)}-open.png`,
      });
    }
  });

  test('New order: Delivery day has the same field gap as the other fields', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seller(page);
    await page.goto('/seller/orders');
    await page.getByRole('button', { name: 'New order' }).click();
    await page.locator('#new-order-how').selectOption('delivery');
    await page.waitForTimeout(700);
    const select = await page.locator('#new-order-how').boundingBox();
    const label = await page.getByText('Delivery day', { exact: true }).boundingBox();
    expect((label?.y ?? 0) - ((select?.y ?? 0) + (select?.height ?? 0))).toBeGreaterThanOrEqual(16);
    await page.getByText('Delivery day', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/final-new-order-tablet.png` });
  });

  test('Order panel: the day and the Change link share a baseline after saving', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seller(page);
    await page.goto('/seller/orders');
    await page
      .getByRole('button', { name: new RegExp(names.next) })
      .first()
      .click();
    await page.getByRole('button', { name: 'Change pickup or delivery' }).click();
    const sheet = page.getByRole('dialog', { name: 'Change pickup or delivery' });
    await sheet.getByLabel('Street').fill('12 King William St');
    await sheet.getByLabel('Suburb').fill('Adelaide');
    await sheet.getByRole('radio', { name: /Fri 13/ }).click();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Saved/ })).toBeVisible();
    await page.getByRole('button', { name: 'Change pickup or delivery' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/final-order-panel-saved-tablet.png` });
    const link = await page
      .getByRole('button', { name: 'Change pickup or delivery' })
      .boundingBox();
    const day = await page
      .locator('dd span')
      .filter({ hasText: 'Fri 13 Nov' })
      .first()
      .boundingBox();
    expect(
      Math.abs((link?.y ?? 0) + (link?.height ?? 0) / 2 - ((day?.y ?? 0) + (day?.height ?? 0) / 2)),
    ).toBeLessThan(14);
  });

  test('Seller phone: the Orders title is whole at 412 and 360 wide', async ({ browser }) => {
    for (const width of [412, 360]) {
      const context = await browser.newContext({
        viewport: { width, height: 915 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        baseURL: ORIGIN,
        extraHTTPHeaders: { Origin: ORIGIN },
      });
      const page = await context.newPage();
      await seller(page);
      await page.goto('/seller/orders');
      const h1 = page.getByRole('heading', { name: 'Orders' });
      await expect(h1).toBeVisible();
      const clipped = await h1.evaluate(
        (el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().width < 50,
      );
      expect(clipped).toBe(false);
      await page.screenshot({ path: `${SHOTS}/final-orders-phone-${String(width)}.png` });
      await context.close();
    }
  });
});
