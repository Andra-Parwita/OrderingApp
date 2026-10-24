import { expect, test, type Page } from '@playwright/test';
import { goToName, markHowItWorksSeen } from './customerHelpers';
import { collectErrors } from './sellerHelpers';

// Safety net for plans 101/102 (docs/plans/102-route-safety-checklist.md): the customer routes all
// open, survive a reload and log no console errors. Since plan 102 stage 4 an order lives under its
// kitchen (`/<slug>/o/<token>`) and every old link (`/o/<token>...`) is redirected by the Worker.

async function placeOrder(page: Page, firstName: string): Promise<string> {
  await page.goto('/onde-onde/dishes');
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await goToName(page);
  await page.getByLabel('First name').fill(firstName);
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/onde-onde\/o\/[^/]+\/placed$/);
  const token = /\/o\/([^/]+)\/placed$/.exec(page.url())?.[1];
  if (!token) throw new Error('no token in the URL');
  return token;
}

test.describe('route safety', () => {
  test('an order opens by /<slug>/o/<token>, /qr, /<slug>/my-orders and /<slug>/settings, and survives reload', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'one run, on the phone');
    // About ten full page loads; the dev server serves each as hundreds of modules, ~4 s each when the suite runs in parallel.
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await markHowItWorksSeen(page.context());
    const firstName = `Route-${Date.now()}`;
    const token = await placeOrder(page, firstName);
    const orderCode = (await page.getByTestId('order-code').textContent()) ?? '';
    expect(orderCode).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);

    // The Worker answers every route with the app (HTML 200), an unknown token included. The old
    // order addresses are redirected first (the request follows the redirect).
    for (const path of [
      `/onde-onde/o/${token}`,
      `/onde-onde/o/${token}/placed`,
      `/onde-onde/o/${token}/qr`,
      `/onde-onde/o/${token}/edit`,
      `/onde-onde/o/${token}/edit/name`,
      `/o/${token}`,
      `/o/${token}/placed`,
      `/o/${token}/qr`,
      `/o/${token}/edit`,
      `/o/${token}/edit/name`,
      '/o/no-such-token-at-all',
      '/onde-onde/o/no-such-token-at-all',
      '/my-orders',
      '/settings',
      '/onde-onde/my-orders',
      '/onde-onde/settings',
      '/onde-onde',
      '/seller',
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type'], path).toContain('text/html');
    }

    // The order page, by link.
    await page.goto(`/onde-onde/o/${token}`);
    await expect(page.getByRole('button', { name: 'Change order' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Change order' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/onde-onde/o/${token}$`));

    // The QR page.
    await page.goto(`/onde-onde/o/${token}/qr`);
    await expect(page).toHaveURL(new RegExp(`/onde-onde/o/${token}/qr$`));
    await expect(page.locator('svg, canvas, img').first()).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/onde-onde/o/${token}/qr$`));
    await expect(page.locator('svg, canvas, img').first()).toBeVisible();

    // My orders lists the order under its kitchen; the slug-less address goes there (D-120).
    for (const path of ['/onde-onde/my-orders', '/my-orders']) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: new RegExp(orderCode) })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('button', { name: new RegExp(orderCode) })).toBeVisible();
    }

    // Settings.
    await page.goto('/onde-onde/settings');
    await expect(page).toHaveURL(/\/onde-onde\/settings$/);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/onde-onde\/settings$/);
    await expect(page.getByRole('heading').first()).toBeVisible();

    // An unknown token still shows the app (not a Worker 404 page), in both shapes.
    for (const path of ['/o/no-such-token-at-all', '/onde-onde/o/no-such-token-at-all']) {
      await page.goto(path);
      await expect(page.locator('#root')).not.toBeEmpty();
    }

    expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
  });

  test('102: old /o/<token> redirects to /onde-onde/o/<token> (302, sub-paths and query kept)', async ({
    page,
    request,
  }) => {
    const token = await placeOrder(page, `Route-${Date.now()}`);
    const res = await request.get(`/o/${token}`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain(`/onde-onde/o/${token}`);
    for (const sub of ['/qr', '/placed', '/edit', '/edit/name']) {
      const sent = await request.get(`/o/${token}${sub}?source=homescreen`, { maxRedirects: 0 });
      expect(sent.status(), sub).toBe(302);
      expect(sent.headers()['location'], sub).toContain(
        `/onde-onde/o/${token}${sub}?source=homescreen`,
      );
      await page.goto(`/o/${token}${sub}`);
      await expect(page).toHaveURL(new RegExp(`/onde-onde/o/${token}${sub}$`));
    }
    // An unknown token is not redirected: the app answers and shows its own not found.
    const unknown = await request.get('/o/no-such-token-at-all', { maxRedirects: 0 });
    expect(unknown.status()).toBe(200);
  });

  test('102: /<wrongslug>/o/<token> corrects the slug', async ({ page, request }) => {
    const token = await placeOrder(page, `Route-${Date.now()}`);
    const res = await request.get(`/dapur-demo/o/${token}`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain(`/onde-onde/o/${token}`);
    await page.goto(`/dapur-demo/o/${token}`);
    await expect(page).toHaveURL(new RegExp(`/onde-onde/o/${token}$`));
  });

  test('102: /<slug>/o/<token> opens the order and survives reload', async ({ page }) => {
    const token = await placeOrder(page, `Route-${Date.now()}`);
    await page.goto(`/onde-onde/o/${token}`);
    await expect(page.getByRole('button', { name: 'Change order' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Change order' })).toBeVisible();
  });

  test('102/D-120: /<slug>/my-orders and /<slug>/settings open; /my-orders and /settings go to the last kitchen', async ({
    page,
  }) => {
    // Nothing visited yet: the slug-less pages stay as they are.
    for (const path of ['/my-orders', '/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`^[^?#]*${path}$`));
      await expect(page.locator('#root')).not.toBeEmpty();
    }
    for (const path of ['/onde-onde/my-orders', '/onde-onde/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('#root')).not.toBeEmpty();
    }
    // The kitchen is now the last one visited.
    for (const path of ['/my-orders', '/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/onde-onde${path}$`));
      await expect(page.locator('#root')).not.toBeEmpty();
    }
  });

  test('102: the customer manifest of an order page has start_url inside its scope', async ({
    page,
    request,
  }) => {
    const token = await placeOrder(page, `Route-${Date.now()}`);
    await page.goto(`/onde-onde/o/${token}`);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = (await (await request.get(href ?? '')).json()) as {
      scope: string;
      start_url: string;
    };
    const path = new URL(manifest.start_url, 'https://x.test').pathname;
    expect(path.startsWith(manifest.scope)).toBe(true);
    // The order starts under its own kitchen (plan 102), whatever the scope switch says.
    expect(manifest.start_url).toBe(`/onde-onde/o/${token}?source=homescreen`);
  });
});
