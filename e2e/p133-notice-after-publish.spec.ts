import { expect, test, type Browser, type Page } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Plan 133: the question "Send a notification to customers who already have the app?" right after a
// menu is published (phone card, tablet Publish step). Captures go to scratch/cap-133. Unpublishes and
// publishes Onde Onde's menu (and leaves it published), so it runs with the isolated specs.

const SELLER = 'onde-onde';
const HEADERS = { 'X-Seller': SELLER };
const SHOTS = 'scratch/cap-133';
const ORIGIN = 'https://localhost:5181';
const ASK_EN = 'Send a notification to customers who already have the app?';
const ASK_ID = 'Kirim notifikasi ke pelanggan yang sudah punya aplikasinya?';
const SEND_URL = '**/api/seller/menu-notices/send';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

type Cfg = Readonly<{
  name: string;
  width: number;
  height: number;
  font: number;
  lang: 'en' | 'id';
}>;

async function open(browser: Browser, cfg: Cfg, phone: boolean): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    timezoneId: 'Australia/Adelaide',
    baseURL: ORIGIN,
    extraHTTPHeaders: { Origin: ORIGIN },
  });
  const page = await context.newPage();
  await page.addInitScript(
    ([slug, lang, font]) => {
      localStorage.setItem('devSeller', String(slug));
      localStorage.setItem('lang', String(lang));
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = `${String(font)}%`;
      });
    },
    [SELLER, cfg.lang, cfg.font],
  );
  return page;
}

/** The question is a dialog; its two buttons sit on one row and nothing is cut off. */
async function expectAskTidy(page: Page, ask: string, width: number): Promise<void> {
  const dialog = page.getByRole('dialog', { name: ask });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(500); // the sheet slides up
  const box = await dialog.boundingBox();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width + 1);
  const buttons = await dialog.getByRole('button').evaluateAll((els) =>
    els
      .filter((el) => /^(Not now|Send|Nanti saja|Kirim)$/.test(el.textContent?.trim() ?? ''))
      .map((el) => ({
        y: Math.round(el.getBoundingClientRect().y),
        clipped: el.scrollWidth > el.clientWidth + 1,
      })),
  );
  expect(buttons.length).toBeGreaterThanOrEqual(2);
  expect(new Set(buttons.map((b) => b.y)).size).toBe(1);
  for (const b of buttons) expect(b.clipped).toBe(false);
  const spill = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(spill).toBeLessThanOrEqual(1);
}

const PHONES: ReadonlyArray<Cfg> = [
  { name: 'phone-412x915-en', width: 412, height: 915, font: 100, lang: 'en' },
  { name: 'phone-412x915-text150-en', width: 412, height: 915, font: 150, lang: 'en' },
  { name: 'phone-412x915-id', width: 412, height: 915, font: 100, lang: 'id' },
];

let cooking = '';
let cutoff = '';

test.beforeAll(async ({ request }) => {
  const reply = (await (
    await request.get('/api/seller/menus/current', { headers: HEADERS })
  ).json()) as { menu: { menu: { cookingDate: string; cutoffAt: string } } };
  cooking = reply.menu.menu.cookingDate;
  cutoff = reply.menu.menu.cutoffAt;
});

test.beforeEach(async ({ request }) => {
  const un = await request.post('/api/seller/menus/current/unpublish', { headers: HEADERS });
  expect(un.ok(), await un.text()).toBe(true);
  // The seeded cut-off can fall after the cooking day, which keeps the phone card "Not ready".
  const day = Date.parse(`${cooking}T00:00:00Z`);
  const fix = await request.put('/api/seller/menus/current', {
    headers: HEADERS,
    data: { cutoffAt: new Date(day - 2 * 86_400_000 + 10 * 3_600_000).toISOString() },
  });
  expect(fix.ok(), await fix.text()).toBe(true);
});
test.afterEach(async ({ request }) => {
  await request.put('/api/seller/menus/current', { headers: HEADERS, data: { cutoffAt: cutoff } });
  await request.post('/api/seller/menus/current/publish', { headers: HEADERS, data: {} });
});

for (const cfg of PHONES) {
  test(`phone: question after Publish at ${cfg.name}`, async ({ browser }) => {
    const en = cfg.lang === 'en';
    const page = await open(browser, cfg, true);
    const errors = collectErrors(page);
    let sends = 0;
    await page.route(SEND_URL, async (route) => {
      sends += 1;
      await route.continue();
    });
    await page.goto('/seller/orders');
    await page.getByRole('button', { name: en ? 'Publish menu' : 'Terbitkan menu' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: en ? 'Publish menu' : 'Terbitkan menu' })
      .click();
    const ask = en ? ASK_EN : ASK_ID;
    await expectAskTidy(page, ask, cfg.width);
    await page.screenshot({ path: `${SHOTS}/${cfg.name}-ask.png` });
    if (cfg.font === 100 && en) {
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(page.getByRole('dialog', { name: ask })).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'Menu is live ✓' })).toBeVisible();
      expect(sends).toBe(1);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/${cfg.name}-after-send.png` });
    } else {
      await page
        .getByRole('dialog', { name: ask })
        .getByRole('button', { name: en ? 'Not now' : 'Nanti saja' })
        .click();
      await expect(page.getByRole('dialog', { name: ask })).toHaveCount(0);
      expect(sends).toBe(0);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/${cfg.name}-after-not-now.png` });
    }
    expect(errors).toEqual([]);
    await page.context().close();
  });
}

for (const size of [
  { name: 'tablet-1280x800', width: 1280, height: 800 },
  { name: 'tablet-800x1280', width: 800, height: 1280 },
]) {
  test(`tablet: question after the Publish step at ${size.name}`, async ({ browser }) => {
    const cfg: Cfg = { ...size, font: 100, lang: 'en' };
    const page = await open(browser, cfg, false);
    const errors = collectErrors(page);
    let sends = 0;
    await page.route(SEND_URL, async (route) => {
      sends += 1;
      await route.continue();
    });
    await page.goto('/seller/menu');
    await page.getByRole('button', { name: 'Continue to step 4' }).click();
    await page.getByRole('button', { name: 'Publish menu' }).click();
    await page.getByRole('button', { name: 'Publish and open orders' }).click();
    await expectAskTidy(page, ASK_EN, size.width);
    await page.screenshot({ path: `${SHOTS}/${size.name}-ask.png` });
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('dialog', { name: ASK_EN })).toHaveCount(0);
    expect(sends).toBe(1);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${size.name}-after-send.png` });
    expect(errors).toEqual([]);
    await page.context().close();
  });
}
