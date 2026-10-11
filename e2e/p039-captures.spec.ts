import {
  request as pwRequest,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from '@playwright/test';
import { adminSignIn, keepAdminPasskey, originHeaders } from './adminSession';
import { markHowItWorksSeen } from './customerHelpers';
import { collectErrors } from './sellerHelpers';

// Plan 039 (seller Home) and 038 (admin two panels): capture-only. PNGs go to captures/p039/.
// A step that cannot be reached is logged as UNREACHED and skipped; console errors are logged.

test.beforeEach(({ browserName }, testInfo) => {
  void browserName;
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop project only');
});
test.describe.configure({ mode: 'serial' });

const DIR = 'captures/p039';
const notes: Array<string> = [];
const allErrors: Array<string> = [];

async function step(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    const text = `UNREACHED ${label}: ${String(error).split('\n')[0]}`;
    notes.push(text);
    console.log(text);
  }
}

const shot = (page: Page, name: string, fullPage = false) =>
  page.screenshot({ path: `${DIR}/${name}.png`, fullPage });

function watch(page: Page, label: string) {
  const errors = collectErrors(page);
  return () => allErrors.push(...errors.map((text) => `${label}: ${text}`));
}

async function newPage(
  browser: Browser,
  baseURL: string | undefined,
  w: number,
  h: number,
  scheme: 'light' | 'dark' = 'light',
) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: w, height: h },
    colorScheme: scheme,
  });
  await markHowItWorksSeen(context);
  return { context, page: await context.newPage() };
}

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

test('1 admin two panels', async ({ browser, request }, testInfo) => {
  test.setTimeout(180_000);
  await adminSignIn(request, 'seller-auth-desktop-chromium');
  for (const [name, slug] of [
    ['Warung Capture', 'warung-capture'],
    ['Cafe Capture', 'cafe-capture'],
  ]) {
    await request.post('/api/admin/sellers', { headers: originHeaders, data: { name, slug } });
  }
  for (const scheme of ['light', 'dark'] as const) {
    for (const [w, h] of [
      [1361, 865],
      [390, 844],
    ] as const) {
      const { context, page } = await newPage(browser, testInfo.project.use.baseURL, w, h, scheme);
      const flush = watch(page, `admin-${scheme}-${w}`);
      await step(`admin ${scheme} ${w}`, async () => {
        await keepAdminPasskey(page, 'admin-desktop-chromium');
        await page.goto('/admin/sign-in');
        await page.getByRole('button', { name: 'Sign in with passkey' }).click();
        await page.waitForURL(/\/admin$/);
        await page.waitForTimeout(1500);
        await shot(page, `admin-${scheme}-${w}x${h}-initial`, true);
        const rows = page.getByRole('button', { name: /Created/ });
        const n = await rows.count();
        notes.push(`admin ${scheme} ${w}: ${n} Created-rows`);
        if (n > 0) await rows.nth(Math.min(1, n - 1)).click();
        await page.waitForTimeout(1200);
        await shot(page, `admin-${scheme}-${w}x${h}-expanded`, true);
      });
      flush();
      await context.close();
    }
  }
});

async function capture(
  browser: Browser,
  baseURL: string | undefined,
  slug: string,
  name: string,
  path = '/seller',
  w = 1180,
  h = 820,
  after?: (page: Page) => Promise<void>,
) {
  const { context, page } = await newPage(browser, baseURL, w, h);
  await context.addInitScript((s) => localStorage.setItem('devSeller', s), slug);
  const flush = watch(page, name);
  await step(name, async () => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await shot(page, name);
    await shot(page, `${name}-full`, true);
    if (after) await after(page);
  });
  flush();
  await context.close();
}

const S = { headers: { 'X-Seller': 'onde-onde' } };
// The admin's session cookie would win over the dev headers, so seller calls use a cookie-free context.
const plain = (baseURL: string | undefined) =>
  pwRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: originHeaders.Origin } });
async function put(request: APIRequestContext, data: object) {
  const r = await request.put('/api/seller/menus/current', { ...S, data });
  if (!r.ok()) notes.push(`PUT menu ${JSON.stringify(data)} -> ${r.status()} ${await r.text()}`);
}

test('2 seller home states', async ({ browser, request: adminRequest }, testInfo) => {
  test.setTimeout(300_000);
  const baseURL = testInfo.project.use.baseURL;
  const request = await plain(baseURL);

  await adminSignIn(adminRequest, 'seller-auth-desktop-chromium');
  const fresh = `fresh-${Date.now().toString(36)}`;
  await adminRequest.post('/api/admin/sellers', {
    headers: originHeaders,
    data: { name: 'Fresh Kitchen', slug: fresh },
  });
  await capture(browser, baseURL, fresh, 'home-1-first-time');

  await request.post('/api/dev/reset');
  const unpub = await request.post('/api/seller/menus/current/unpublish', S);
  if (!unpub.ok()) notes.push(`unpublish ${unpub.status()} ${await unpub.text()}`);
  await capture(browser, baseURL, 'onde-onde', 'home-2-not-published');

  await request.post('/api/dev/reset');
  await request.post('/api/dev/sample-orders', { ...S, data: { count: 50 } });
  const cur = await request.get('/api/seller/menus/current', S);
  notes.push(`current menu after reset: ${(await cur.text()).slice(0, 500)}`);
  await capture(browser, baseURL, 'onde-onde', 'home-3-taking-orders');

  await put(request, { takingOrders: false });
  await capture(browser, baseURL, 'onde-onde', 'home-3b-orders-paused');
  await put(request, { takingOrders: true });

  await put(request, {
    cookingDate: day(3),
    cutoffAt: new Date(Date.now() - 3_600_000).toISOString(),
  });
  await capture(browser, baseURL, 'onde-onde', 'home-4a-orders-closed');

  await put(request, { cookingDate: day(0) });
  await capture(browser, baseURL, 'onde-onde', 'home-4b-cooking-day');

  await capture(browser, baseURL, 'onde-onde', 'orders-desktop', '/seller/orders');

  const fin = await request.post('/api/seller/menus/current/finish', S);
  if (!fin.ok()) notes.push(`finish ${fin.status()} ${await fin.text()}`);
  await capture(
    browser,
    baseURL,
    'onde-onde',
    'home-5-no-menu-running',
    '/seller',
    1180,
    820,
    async (page) => {
      const open = page.getByRole('button', { name: 'New menu', exact: true });
      await open.click({ timeout: 5000 });
      await page.waitForTimeout(800);
      await shot(page, 'home-6-new-menu-dialog');
    },
  );
  await capture(browser, baseURL, 'onde-onde', 'orders-no-menu-running', '/seller/orders');
  await request.post('/api/dev/reset');
  console.log(`NOTES2:\n${notes.join('\n')}`);
});

test('3 phone', async ({ browser }, testInfo) => {
  const request = await plain(testInfo.project.use.baseURL);
  await request.post('/api/dev/reset');
  await request.post('/api/dev/sample-orders', { ...S, data: { count: 20 } });
  await capture(
    browser,
    testInfo.project.use.baseURL,
    'onde-onde',
    'phone-seller-390x844',
    '/seller',
    390,
    844,
  );
  await request.post('/api/dev/reset');
  console.log(`CAPTURE NOTES:\n${notes.join('\n') || '(none)'}`);
  console.log(`CONSOLE ERRORS:\n${allErrors.join('\n') || '(none)'}`);
});
