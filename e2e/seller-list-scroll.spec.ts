import { expect, test, type Page } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Plan 008: with 50 sample orders the Orders home does not scroll as a page; only the order list
// does (and the order panel on its own), so the header, tabs, bottom bar and the panel's buttons
// stay where the seller left them. Uses Dapur Demo (its two limited dishes leave plenty of room), so
// the other specs' kitchen keeps its portions.

const SELLER = 'dapur-demo';

/** The tallest scroll area inside <main>: the order list. Reports its scroll state. */
async function listScroller(page: Page, scrollTo?: number) {
  return page.evaluate((to) => {
    const areas = Array.from(document.querySelectorAll<HTMLElement>('main *')).filter(
      (element) =>
        getComputedStyle(element).overflowY === 'auto' &&
        element.scrollHeight > element.clientHeight + 1,
    );
    areas.sort((a, b) => b.scrollHeight - a.scrollHeight);
    const area = areas[0];
    if (!area) return null;
    if (to !== undefined) area.scrollTop = to === -1 ? area.scrollHeight / 2 : to;
    return { top: area.scrollTop, height: area.clientHeight, full: area.scrollHeight };
  }, scrollTo);
}

const pageScrolls = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);

test('only the order list scrolls, with 50 sample orders', async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  const desktop = testInfo.project.name.includes('desktop');
  const viewport = desktop ? { width: 1180, height: 820 } : { width: 390, height: 844 };
  const baseURL = testInfo.project.use.baseURL;

  const sampled = await request.post('/api/dev/sample-orders', {
    headers: { 'X-Seller': SELLER },
    data: { count: 50 },
  });
  expect(sampled.ok()).toBe(true);
  const answer = (await sampled.json()) as { added: number };
  expect(answer.added).toBeGreaterThan(0);

  const context = await browser.newContext({ baseURL, viewport });
  try {
    await context.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto('/seller');
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    await expect.poll(async () => (await listScroller(page))?.full ?? 0).toBeGreaterThan(1000);

    // The page itself never scrolls.
    expect(await pageScrolls(page)).toBe(false);

    const heading = page.getByRole('heading', { level: 1, name: 'Orders' });
    const before = await heading.boundingBox();
    const middle = await listScroller(page, -1);
    expect(middle?.top).toBeGreaterThan(100);
    expect(await pageScrolls(page)).toBe(false);
    // Header unmoved, still on screen.
    const after = await heading.boundingBox();
    expect(after?.y).toBe(before?.y);

    if (desktop) {
      await expect(page.getByRole('group', { name: 'Status' })).toBeVisible();
      // Open an order from the middle of the list: its panel keeps its buttons in view.
      const rows = page.locator('[data-row-id]');
      const middleRow = rows.nth(Math.floor((await rows.count()) / 2));
      await middleRow.scrollIntoViewIfNeeded();
      await middleRow.click();
      const panel = page.getByRole('complementary');
      const send = panel.getByRole('button', { name: 'Send link on WhatsApp' });
      await expect(send).toBeVisible();
      const box = await send.boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      expect(await pageScrolls(page)).toBe(false);
      // The list kept its place.
      expect((await listScroller(page))?.top).toBeGreaterThan(100);
      await page.screenshot({ path: 'captures/p008/orders-desktop-1180x820.png' });
      // Plan 014: collapsing the banner gives the list room; the order stays open.
      const rowsBefore = (await listScroller(page))?.height ?? 0;
      await page.getByRole('button', { name: 'Show more orders' }).click();
      await expect(page.getByRole('button', { name: 'Show the banner' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      await expect
        .poll(async () => (await listScroller(page))?.height ?? 0)
        .toBeGreaterThan(rowsBefore + 80);
      expect(await pageScrolls(page)).toBe(false);
      await page.screenshot({ path: 'captures/p014/collapsed-1180.png' });
      // Plan 015: the order's buttons are one row, and Dishes opens as a slide-over.
      await page.screenshot({ path: 'captures/p015/collapsed-order-open-1180x820.png' });
      await page
        .locator('main > header')
        .getByRole('button', { name: 'More', exact: true })
        .click();
      await page.getByRole('menuitem', { name: /^Dishes \d+$/ }).click();
      await expect(page.getByRole('dialog', { name: 'Dishes' })).toBeVisible();
      await page.screenshot({ path: 'captures/p015/dishes-open-1180x820.png' });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } else {
      await page.getByRole('button', { name: /^Dishes \d+$/ }).click();
      await expect(page.getByRole('dialog', { name: 'Dishes' })).toBeVisible();
      await page.screenshot({ path: 'captures/p015/dishes-phone-390x844.png' });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const bar = page.locator('footer nav');
      await expect(bar).toBeVisible();
      const box = await bar.boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height + 1);
      await page.screenshot({ path: 'captures/p008/orders-phone-390x844.png' });
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
