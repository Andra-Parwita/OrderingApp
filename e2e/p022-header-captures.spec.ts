import { expect, test, type Page } from '@playwright/test';
import { collectErrors, pageScrollWidth } from './sellerHelpers';

// Plan 022: the Orders header at the iPad widths, with an order open and the banner expanded (the
// worst case). Nothing may spill sideways, and the header's buttons must not overlap each other.

const SELLER = 'dapur-demo';

/** Every pair of visible header buttons: their boxes must not intersect. */
async function expectNoOverlap(page: Page, label: string) {
  const boxes = await page.evaluate(() => {
    const head = document.querySelector('main > header');
    const items = Array.from(
      head?.querySelectorAll<HTMLElement>('button, h1, [role="switch"]') ?? [],
    );
    return items.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        name: el.getAttribute('aria-label') ?? el.textContent ?? '',
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
      };
    });
  });
  for (const [i, a] of boxes.entries()) {
    expect(a.x + a.w, `${label}: ${a.name} spills right`).toBeLessThanOrEqual(
      page.viewportSize()?.width ?? 0,
    );
    for (const b of boxes.slice(i + 1)) {
      const apart =
        a.x + a.w <= b.x + 0.5 ||
        b.x + b.w <= a.x + 0.5 ||
        a.y + a.h <= b.y + 0.5 ||
        b.y + b.h <= a.y + 0.5;
      expect(apart, `${label}: "${a.name}" overlaps "${b.name}"`).toBe(true);
    }
  }
}

test('Orders header fits at 1180, 1024 and 820 px wide', async ({ browser, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'one run, on the desktop project');
  test.setTimeout(90_000);
  const sampled = await request.post('/api/dev/sample-orders', {
    headers: { 'X-Seller': SELLER },
    data: { count: 20 },
  });
  expect(sampled.ok()).toBe(true);

  const shots = [
    { w: 1180, h: 820, file: '1180x820' },
    { w: 1024, h: 768, file: '1024x768' },
    { w: 820, h: 1180, file: '820x1180' },
  ];
  for (const { w, h, file } of shots) {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width: w, height: h },
    });
    try {
      await context.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
      const page = await context.newPage();
      const errors = collectErrors(page);
      await page.goto('/seller');
      await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
      await page.locator('[data-row-id]').nth(3).click();
      await expect(page.getByRole('complementary')).toBeVisible();
      await page.screenshot({ path: `captures/p022/${file}.png` });
      await expectNoOverlap(page, file);
      expect(await pageScrollWidth(page)).toBeLessThanOrEqual(w);

      if (w === 1024) {
        await page.getByRole('button', { name: 'Search orders' }).click();
        await expect(page.getByRole('searchbox', { name: 'Name or code' })).toBeFocused();
        await page.getByRole('searchbox').fill('Rina');
        await expect(page.getByRole('searchbox')).toHaveValue('Rina');
        await expectNoOverlap(page, `${file} search`);
        await page.screenshot({ path: 'captures/p022/search-open-1024x768.png' });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('searchbox')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^Not paid \d+$/ })).toBeVisible();
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }
});
