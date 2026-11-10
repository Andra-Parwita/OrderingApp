import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { addDays } from '../shared/dates';
import { markHowItWorksSeen } from './customerHelpers';
import { collectErrors } from './sellerHelpers';

// Plan 127: the seller phone changes the menu's delivery days from the read-only menu view (captures at
// 412x915 and 360x780, also at text 125%), and the collapsed tablet rail switches kitchen. Captures go to
// scratch/cap-127. Changes Onde Onde's menu (and puts it back), so it runs with the isolated specs.

const SELLER = 'onde-onde';
const HEADERS = { 'X-Seller': SELLER };
const SHOTS = 'scratch/cap-127';
const NOTE = { en: 'Delivery after 1 pm', id: 'Antar setelah jam 1' };
const ORIGIN = 'https://localhost:5181';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

type MenuReply = {
  menu: { menu: { cookingDate: string; delivery: { available: boolean; note: typeof NOTE } } };
};

let cooking = '';
let original: MenuReply['menu']['menu']['delivery'] | null = null;

async function putDelivery(request: APIRequestContext, available: boolean, days: Array<string>) {
  const set = await request.put('/api/seller/menus/current', {
    headers: HEADERS,
    data: { delivery: { available, note: NOTE, days }, finishExtraDay: false },
  });
  expect(set.ok(), await set.text()).toBe(true);
}

test.beforeAll(async ({ request }) => {
  const reply = (await (
    await request.get('/api/seller/menus/current', { headers: HEADERS })
  ).json()) as MenuReply;
  cooking = reply.menu.menu.cookingDate;
  original = reply.menu.menu.delivery;
  await putDelivery(request, true, []);
});

test.afterAll(async ({ request }) => {
  if (!original) return;
  await request.put('/api/seller/menus/current', {
    headers: HEADERS,
    data: { delivery: { ...original, days: [] }, finishExtraDay: false },
  });
});

const CONFIGS = [
  { name: '412x915', width: 412, height: 915, font: 100 },
  { name: '360x780', width: 360, height: 780, font: 100 },
  { name: '412x915-text125', width: 412, height: 915, font: 125 },
  { name: '360x780-text125', width: 360, height: 780, font: 125 },
] as const;

async function phone(browser: Browser, cfg: (typeof CONFIGS)[number]): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    deviceScaleFactor: 2,
    isMobile: true,
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
  await page.goto('/seller/orders');
  await page.getByRole('button', { name: 'Open the menu' }).click();
  await expect(
    page.getByRole('group', { name: 'Delivery days' }).or(page.getByText(/Delivery is off/)),
  ).toBeVisible();
  return page;
}

/** A day cell of the open menu view (the Orders list behind it has buttons of its own). */
const dayCell = (page: Page, day: string) =>
  page.getByRole('group', { name: 'Delivery days' }).getByRole('button', { name: new RegExp(day) });

async function expectGridTidy(page: Page): Promise<void> {
  const cells = page.getByRole('group', { name: 'Delivery days' }).getByRole('button');
  await expect(cells).toHaveCount(4);
  const boxes = await cells.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const date = el.querySelector('span:last-child > span') as HTMLElement;
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        dateHeight: date.getBoundingClientRect().height,
        size: parseFloat(getComputedStyle(date).fontSize),
        clipped: el.scrollWidth > el.clientWidth + 1,
      };
    }),
  );
  expect(new Set(boxes.map((b) => b.y)).size).toBe(2);
  expect(new Set(boxes.map((b) => b.w)).size).toBe(1);
  expect(boxes[0]?.x).toBe(boxes[2]?.x);
  expect(boxes[1]?.x).toBe(boxes[3]?.x);
  for (const b of boxes) {
    expect(b.dateHeight).toBeLessThan(b.size * 1.6); // one line
    expect(b.clipped).toBe(false);
  }
  const spill = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(spill).toBeLessThanOrEqual(1);
}

test.describe('phone menu view', () => {
  for (const cfg of CONFIGS) {
    test(`days grid, Save bar, default sheet and delivery off at ${cfg.name}`, async ({
      browser,
      request,
    }) => {
      await putDelivery(request, true, []);
      const page = await phone(browser, cfg);
      const errors = collectErrors(page);
      await expectGridTidy(page);
      await page.screenshot({ path: `${SHOTS}/${cfg.name}-normal.png` });

      await dayCell(page, 'Thu').click();
      await expect(page.getByText(/is 2 days before cooking/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save delivery days' })).toBeVisible();
      await expectGridTidy(page);
      const bar = await page.getByRole('button', { name: 'Save delivery days' }).boundingBox();
      expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual(cfg.height);
      await page.getByText(/is 2 days before cooking/).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/${cfg.name}-changed.png` });

      await dayCell(page, 'default').click();
      await expect(page.getByRole('dialog', { name: 'Default delivery day' })).toBeVisible();
      await page.waitForTimeout(500); // the sheet slides up
      await page.screenshot({ path: `${SHOTS}/${cfg.name}-default-sheet.png` });
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Discard' }).click();
      await expect(
        page.getByRole('dialog').getByRole('button', { name: /Share menu/ }),
      ).toBeVisible();
      expect(errors).toEqual([]);
      await page.context().close();

      await putDelivery(request, false, []);
      const off = await phone(browser, cfg);
      await expect(
        off.getByText('Delivery is off for this menu. Turn it on on the tablet.'),
      ).toBeVisible();
      await off.screenshot({ path: `${SHOTS}/${cfg.name}-delivery-off.png` });
      await off.context().close();
      await putDelivery(request, true, []);
    });
  }

  test('Save sends the days and the customer sees them at checkout', async ({
    browser,
    request,
  }) => {
    await putDelivery(request, true, []);
    const page = await phone(browser, CONFIGS[0]);
    await dayCell(page, 'Thu').click();
    await dayCell(page, 'Sun').click();
    await page.getByRole('button', { name: 'Save delivery days' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: /Share menu/ }),
    ).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/412x915-saved.png` });
    await page.context().close();
    const menu = (await (
      await request.get('/api/seller/menus/current', { headers: HEADERS })
    ).json()) as MenuReply & { menu: { menu: { delivery: { days?: Array<string> } } } };
    expect(menu.menu.menu.delivery).toMatchObject({
      days: [addDays(cooking, -2), cooking, addDays(cooking, 1)],
    });

    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      baseURL: ORIGIN,
      extraHTTPHeaders: { Origin: ORIGIN },
    });
    await markHowItWorksSeen(context);
    const customer = await context.newPage();
    await customer.goto('/onde-onde/dishes');
    await customer.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
    await customer.getByRole('button', { name: /View basket/ }).click();
    await customer.getByRole('radio', { name: 'Delivery' }).click();
    await expect(customer.getByRole('radiogroup').last().getByRole('radio')).toHaveCount(3);
    await context.close();
    await putDelivery(request, true, []);
  });
});

test.describe('collapsed rail', () => {
  for (const size of [
    { name: '1280x800', width: 1280, height: 800 },
    { name: '800x1280', width: 800, height: 1280 },
  ]) {
    test(`the logo switches kitchen at ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.addInitScript((slug) => {
        localStorage.setItem('devSeller', slug);
        localStorage.setItem('sellerRailCollapsed', '1');
        localStorage.setItem('signedIn', '1');
      }, SELLER);
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          json: {
            me: {
              role: 'seller',
              stage: 'full',
              sellerId: 'a',
              slug: 'onde-onde',
              sellerName: 'Onde Onde',
            },
          },
        }),
      );
      await page.route('**/api/auth/memberships', (route) =>
        route.fulfill({
          json: {
            memberships: [
              { sellerId: 'a', slug: 'onde-onde', sellerName: 'Onde Onde', role: 'owner' },
              { sellerId: 'b', slug: 'demo', sellerName: 'Dapur Demo', role: 'helper' },
            ],
          },
        }),
      );
      await page.goto('/seller/orders');
      const button = page.getByRole('button', { name: /^Kitchen: / });
      await expect(button).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/rail-${size.name}-closed.png` });
      await button.click();
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(size.width);
      expect(box?.x ?? 0).toBeGreaterThan(40);
      await page.screenshot({ path: `${SHOTS}/rail-${size.name}-open.png` });
    });
  }
});

test.describe('sign-in hint', () => {
  for (const size of [
    { name: '412x915', width: 412, height: 915 },
    { name: '800x1280', width: 800, height: 1280 },
  ]) {
    test(`the screen-lock button has its hint at ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/seller/sign-in?kitchen=dapur-demo');
      await expect(
        page.getByRole('button', { name: /^Sign in with your screen lock/ }),
      ).toBeVisible();
      await expect(
        page.getByText(
          'Your tablet or phone asks for its own fingerprint, face or the PIN you unlock it with.',
        ),
      ).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/signin-${size.name}.png` });
    });
  }
});

test.describe('phone layer top bar', () => {
  for (const size of [
    { width: 412, height: 915 },
    { width: 360, height: 780 },
  ]) {
    test(`Share layer title is centred at ${String(size.width)}x${String(size.height)}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: size,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        baseURL: ORIGIN,
        extraHTTPHeaders: { Origin: ORIGIN },
      });
      const page = await context.newPage();
      await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
      await page.goto('/seller/orders');
      await page.getByRole('button', { name: 'Open the menu' }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /Share menu/ })
        .click();
      const layer = page.getByRole('dialog', { name: 'Share menu' });
      await expect(layer).toBeVisible();
      const bar = layer.locator('header');
      const { title, whole } = await bar.evaluate((el) => {
        const t = (el.children[1] as HTMLElement).getBoundingClientRect();
        const w = el.getBoundingClientRect();
        return {
          title: { x: t.x, width: t.width },
          whole: { x: w.x, width: w.width },
        };
      });
      expect(Math.abs(title.x + title.width / 2 - (whole.x + whole.width / 2))).toBeLessThan(2);
      await page.screenshot({
        path: `scratch/cap-128/center-share-${String(size.width)}x${String(size.height)}.png`,
        clip: { x: 0, y: 0, width: size.width, height: 200 },
      });
      await context.close();
    });
  }
});
