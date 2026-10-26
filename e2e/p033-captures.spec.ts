import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { adminSignIn, keepAdminPasskey, originHeaders } from './adminSession';
import { markHowItWorksSeen } from './customerHelpers';
import { collectErrors } from './sellerHelpers';
import { virtualAuthenticator } from './virtualAuthenticator';

// Plan 033 (and the kitchen/labels/text-size work of the same night): capture-only. Saves PNGs to
// captures/p033/ for the builder to look at before deploy. A screen that cannot be reached is
// logged as UNREACHED and skipped; console errors are logged, not asserted.

test.beforeEach(({ browserName }, testInfo) => {
  void browserName;
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop project only');
});
test.describe.configure({ mode: 'serial' });

const DIR = 'captures/p033';
const PASSWORD = 'capture long enough password';
const createPasskey = /^(Screen lock|Add a new passkey)/;
const notes: Array<string> = [];
const allErrors: Array<string> = [];

/** Runs one capture step; a failure is noted and the test goes on. */
async function step(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    const text = `UNREACHED ${label}: ${String(error).split('\n')[0]}`;
    notes.push(text);
    console.log(text);
  }
}

const shot = (page: Page, name: string, fullPage = true) =>
  page.screenshot({ path: `${DIR}/${name}.png`, fullPage });

function watch(page: Page, label: string) {
  const errors = collectErrors(page);
  return () => allErrors.push(...errors.map((text) => `${label}: ${text}`));
}

async function inviteKey(
  request: APIRequestContext,
  slug: string,
  displayName: string,
): Promise<string> {
  await adminSignIn(request, 'seller-auth-desktop-chromium');
  const sellers = await request.get('/api/admin/sellers');
  const list = (await sellers.json()) as { sellers: Array<{ id: string; slug: string }> };
  const seller = list.sellers.find((candidate) => candidate.slug === slug);
  if (!seller) throw new Error(`${slug} is not seeded`);
  const invite = await request.post(`/api/admin/sellers/${seller.id}/invite-key`, {
    headers: originHeaders,
    data: { displayName },
  });
  expect(invite.ok()).toBe(true);
  return ((await invite.json()) as { key: string }).key;
}

async function newPage(browser: Browser, baseURL: string | undefined, w: number, h: number) {
  const context = await browser.newContext({ baseURL, viewport: { width: w, height: h } });
  await markHowItWorksSeen(context);
  return { context, page: await context.newPage() };
}

/**
 * Joins a new person to a kitchen through its invite link, as a real browser would (passkey or
 * password). `prefix` (with a width suffix) names the screenshots of the join steps; none if absent.
 */
async function onboard(
  page: Page,
  request: APIRequestContext,
  opts: { slug: string; name: string; how: 'passkey' | 'password'; prefix?: string },
) {
  const key = await inviteKey(request, opts.slug, opts.name);
  const w = page.viewportSize()?.width ?? 0;
  const tag = opts.prefix ? `${opts.prefix}-${w}` : '';
  await page.goto(`/seller/setup?kitchen=${opts.slug}#key=${key}`);
  await expect(page.getByLabel('Invite key from the kitchen owner')).toHaveValue(key);
  expect(page.url()).not.toContain('#');
  if (tag) await shot(page, `${tag}-1-invite-link-key-filled`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /^Welcome/ })).toBeVisible();
  if (tag) await shot(page, `${tag}-2-welcome-passkey`);
  if (opts.how === 'passkey') {
    await page.getByRole('button', { name: createPasskey }).click();
  } else {
    await page.getByRole('button', { name: /Set a password/ }).click();
    await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Name of this device').fill('Capture device');
    await page.getByRole('button', { name: 'Save password' }).click();
  }
  await expect(page).toHaveURL(/\/seller$/);
}

/** A signed-in person opens another kitchen's invite link and joins. */
async function joinSecond(
  page: Page,
  request: APIRequestContext,
  name: string,
  slug: string,
  prefix?: string,
) {
  const key = await inviteKey(request, slug, name);
  await page.waitForTimeout(600); // let the first screen's loads finish
  await page.goto(`/seller/setup?kitchen=${slug}#key=${key}`);
  await expect(page.getByRole('heading', { name: /^Join/ })).toBeVisible();
  if (prefix) await shot(page, `${prefix}-${page.viewportSize()?.width}-3-join-kitchen`);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page).toHaveURL(/\/seller$/);
}

const SIZES = [
  { w: 390, h: 844 },
  { w: 1280, h: 800 },
];

test('1 sign-in and join', async ({ browser, request }, testInfo) => {
  test.setTimeout(180_000);
  const baseURL = testInfo.project.use.baseURL;
  for (const { w, h } of SIZES) {
    const { context, page } = await newPage(browser, baseURL, w, h);
    const flush = watch(page, `join-${w}`);
    await virtualAuthenticator(page);
    await step(`join ${w}`, async () => {
      await onboard(page, request, {
        slug: 'dapur-demo',
        name: `Sari ${w}`,
        how: 'passkey',
        prefix: 'join',
      });
      await joinSecond(page, request, `Sari ${w}`, 'onde-onde', 'join');
    });
    flush();
    await context.close();
  }

  // A person with a password, then the password sign-in with the "Who are you?" picker.
  const maker = await newPage(browser, baseURL, 390, 844);
  await step('make password person', () =>
    onboard(maker.page, request, { slug: 'dapur-demo', name: 'Dewi Password', how: 'password' }),
  );
  await maker.context.close();
  for (const { w, h } of SIZES) {
    const { context, page } = await newPage(browser, baseURL, w, h);
    const flush = watch(page, `signin-${w}`);
    await step(`password sign-in ${w}`, async () => {
      await page.goto('/seller/sign-in?kitchen=dapur-demo');
      await page.getByRole('button', { name: 'Use password instead' }).click();
      await page.getByLabel('Who are you?').selectOption({ label: 'Dewi Password' });
      await page.getByLabel('Password', { exact: true }).fill('x');
      await shot(page, `signin-password-picker-${w}`);
    });
    flush();
    await context.close();
  }
});

test('2 kitchen switcher', async ({ browser, request }, testInfo) => {
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL;
  for (const { w, h, path, file } of [
    { w: 1280, h: 800, path: '/seller/orders', file: 'switcher-rail-1280x800' },
    { w: 390, h: 844, path: '/seller/more', file: 'switcher-more-390x844' },
  ]) {
    const { context, page } = await newPage(browser, baseURL, w, h);
    const flush = watch(page, file);
    await virtualAuthenticator(page);
    await step(file, async () => {
      const name = `Wati ${w}`;
      await onboard(page, request, { slug: 'dapur-demo', name, how: 'passkey' });
      await joinSecond(page, request, name, 'onde-onde');
      await page.goto(path);
      await expect(page.getByRole('combobox').first()).toBeVisible();
      await shot(page, file, false);
    });
    flush();
    await context.close();
  }
});

test('3 team screen', async ({ browser, request }, testInfo) => {
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL;
  const other = await newPage(browser, baseURL, 390, 844);
  await virtualAuthenticator(other.page);
  await step('second member', () =>
    onboard(other.page, request, { slug: 'dapur-demo', name: 'Budi Owner', how: 'passkey' }),
  );
  await other.context.close();

  const { context, page } = await newPage(browser, baseURL, 1280, 800);
  const flush = watch(page, 'team');
  await virtualAuthenticator(page);
  await step('team', async () => {
    await onboard(page, request, { slug: 'dapur-demo', name: 'Sari Owner', how: 'passkey' });
    await page.goto('/seller/settings/chefs');
    await expect(page.getByText('Invite someone')).toBeVisible();
    await shot(page, 'team-1280x800-members-and-form');
    await page.getByLabel('Name', { exact: true }).fill('Ayu New Cook');
    await page.getByRole('button', { name: 'Make invite' }).click();
    await expect(page.getByRole('button', { name: 'Copy link with key' })).toBeVisible();
    await shot(page, 'team-1280x800-invite-box');
  });
  flush();
  await context.close();
});

test('4 admin kitchen page', async ({ browser }, testInfo) => {
  const { context, page } = await newPage(browser, testInfo.project.use.baseURL, 1280, 800);
  const flush = watch(page, 'admin');
  await step('admin', async () => {
    await keepAdminPasskey(page, 'admin-desktop-chromium');
    await page.goto('/?harness=admin&screen=signin');
    await page.getByRole('button', { name: 'Sign in with passkey' }).click();
    await expect(page.getByRole('table', { name: 'Sellers' })).toBeVisible();
    await page.getByRole('row', { name: /dapur-demo/ }).click();
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
    await shot(page, 'admin-1280x800-people');
    await page.getByRole('button', { name: 'Create invite key' }).click();
    const box = page.getByRole('region', { name: /^Invite key for/ });
    await box.getByLabel('Name of the person').fill('Rina New Owner');
    await box.getByRole('button', { name: 'Create invite' }).click();
    await expect(box.getByRole('button', { name: 'Copy link with key' })).toBeVisible();
    await shot(page, 'admin-1280x800-invite-box');
  });
  flush();
  await context.close();
});

async function sellerPage(browser: Browser, baseURL: string | undefined, w: number, h: number) {
  const made = await newPage(browser, baseURL, w, h);
  await made.context.addInitScript(() => localStorage.setItem('devSeller', 'onde-onde'));
  return made;
}

async function addOrders(request: APIRequestContext) {
  await request.post('/api/dev/sample-orders', {
    headers: { 'X-Seller': 'onde-onde' },
    data: { count: 8 },
  });
  // Five lines: splits into "1 of 2" on a label (4 lines per label).
  const long = await request.post('/api/s/onde-onde/orders', {
    data: {
      firstName: 'Bu Panjang',
      language: 'en',
      fulfilment: 'pickup',
      lines: ['nasi-campur', 'pesmol', 'ayam-goreng', 'tempe-mendoan', 'lemper'].map((itemId) => ({
        itemId,
        qty: 1,
      })),
    },
  });
  if (!long.ok()) notes.push(`long order not created: ${long.status()}`);
}

test('5 kitchen on phone and tablet', async ({ browser, request }, testInfo) => {
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL;
  await addOrders(request);
  for (const { w, h } of [
    { w: 390, h: 844 },
    { w: 1024, h: 768 },
  ]) {
    const { context, page } = await sellerPage(browser, baseURL, w, h);
    const flush = watch(page, `kitchen-${w}`);
    await step(`cook ${w}`, async () => {
      await page.goto('/seller/cook');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Who ordered/ }).first()).toBeVisible();
      await shot(page, `cook-${w}x${h}`, false);
      await page
        .getByRole('button', { name: /^Who ordered/ })
        .first()
        .click();
      await page.waitForTimeout(400);
      await shot(page, `cook-who-ordered-${w}x${h}`, false);
    });
    await step(`pack ${w}`, async () => {
      await page.goto('/seller/cook?tab=pack');
      const bags = page.getByRole('list', { name: 'Bags' });
      await expect(bags).toBeVisible();
      await bags.getByRole('button').nth(1).click();
      const print = page.getByRole('button', { name: 'Print label', exact: true });
      await expect(print).toBeVisible();
      await print.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await shot(page, `pack-bag-open-${w}x${h}`, false);
    });
    if (w < 600)
      await step(`more ${w}`, async () => {
        await page.goto('/seller/more');
        await expect(page.getByText('Labels').first()).toBeVisible();
        await shot(page, `more-${w}x${h}`, false);
      });
    flush();
    await context.close();
  }
});

test('6 labels', async ({ browser, request }, testInfo) => {
  await addOrders(request);
  const { context, page } = await sellerPage(browser, testInfo.project.use.baseURL, 1280, 800);
  const flush = watch(page, 'labels');
  await step('labels', async () => {
    await page.goto('/seller/labels');
    await expect(page.getByRole('heading', { level: 1, name: 'Print labels' })).toBeVisible();
    await page.getByRole('radio', { name: /A4 sheet/ }).click();
    await page.getByRole('radio', { name: /All not cancelled/ }).click();
    await expect(page.getByText(/\d+ labels? for \d+ orders?/)).toBeVisible();
    await shot(page, 'labels-a4-1280x800');
    await expect(page.getByText('1 of 2').first()).toBeVisible();
  });
  flush();
  await context.close();
});

test('7 text size larger', async ({ browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  const seller = await sellerPage(browser, baseURL, 1024, 768);
  await seller.context.addInitScript(() => localStorage.setItem('textSize', 'larger'));
  const flushSeller = watch(seller.page, 'text-seller');
  await step('seller orders larger', async () => {
    await seller.page.goto('/seller/orders');
    await expect(seller.page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    await shot(seller.page, 'textsize-larger-seller-1024x768', false);
  });
  flushSeller();
  await seller.context.close();

  const customer = await newPage(browser, baseURL, 390, 844);
  await customer.context.addInitScript(() => localStorage.setItem('textSize', 'larger'));
  const flushCustomer = watch(customer.page, 'text-customer');
  await step('customer menu larger', async () => {
    await customer.page.goto('/onde-onde/dishes');
    await expect(customer.page.getByRole('heading', { name: 'Dishes' })).toBeVisible();
    await shot(customer.page, 'textsize-larger-customer-390x844', false);
  });
  flushCustomer();
  await customer.context.close();

  console.log(`CAPTURE NOTES:\n${notes.join('\n') || '(none)'}`);
  console.log(`CONSOLE ERRORS:\n${allErrors.join('\n') || '(none)'}`);
});
