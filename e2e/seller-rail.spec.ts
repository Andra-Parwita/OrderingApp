import { expect, test } from '@playwright/test';
import { collectErrors, pageScrollWidth, searchFor } from './sellerHelpers';

// The collapsible left panel (D-032) and an orders list whose key identifiers never truncate.
// (The cook list's equal-width "who ordered" chips are gone with the Kitchen redesign.) Desktop only; orders are found by a unique name.
test('seller desktop: collapsible rail, nothing cut in the list', async ({
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one run, on the desktop project');
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL;
  const stamp = Date.now();
  const names = [`Wi-${stamp}`, `Maximiliana-Wijayakusuma-${stamp}`, `Tom-${stamp}`];
  for (const firstName of names) {
    const created = await request.post('/api/s/onde-onde/orders', {
      data: {
        firstName,
        language: 'en',
        lines: [{ itemId: 'nasi-campur', qty: 1 }],
        fulfilment: 'pickup',
      },
    });
    expect(created.ok()).toBe(true);
  }

  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto('/seller');
    await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
    const rail = page.getByRole('navigation', { name: 'Seller' });
    const width = async () => (await rail.boundingBox())?.width ?? Number.NaN;
    const remPx = 16;

    // Expanded by default.
    expect(await width()).toBeGreaterThan(8 * remPx);
    const collapse = rail.getByRole('button', { name: 'Collapse menu' });
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');

    // The table at 1024 px, rail expanded: nothing spills, no name is cut.
    async function expectTableUncut(viewport: number): Promise<void> {
      await page.setViewportSize({ width: viewport, height: 800 });
      await searchFor(page, String(stamp));
      const rows = page
        .getByRole('button', { name: new RegExp(String(stamp)) })
        .filter({ hasText: '$15.00' });
      await expect(rows).toHaveCount(3);
      expect(await pageScrollWidth(page), `page width at ${viewport}`).toBeLessThanOrEqual(
        viewport,
      );
      const cutCells: unknown = await page.evaluate(
        `Array.from(document.querySelectorAll('main button'))
          .filter((row) => row.textContent.includes('${stamp}'))
          .flatMap((row) => Array.from(row.querySelectorAll('*')))
          .filter((cell) => cell.scrollWidth > cell.clientWidth + 1).length`,
      );
      expect(cutCells, `cut cells at ${viewport}`).toBe(0);
      await expect(rows.filter({ hasText: names[1] ?? '' })).toContainText(names[1] ?? '');
    }
    await page.setViewportSize({ width: 1024, height: 800 });
    await expectTableUncut(1024);

    // Collapse: an icon strip, names on focus, current page still marked.
    await page.setViewportSize({ width: 1280, height: 800 });
    await collapse.click();
    const expand = rail.getByRole('button', { name: 'Expand menu' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(width).toBeLessThan(5 * remPx);
    await expect(rail.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await rail.getByRole('link', { name: 'Kitchen' }).focus();
    await expect(
      rail.getByText('Kitchen', { exact: true }).and(page.locator('[aria-hidden]')),
    ).toBeVisible();
    await rail.getByRole('link', { name: 'Orders' }).hover();
    await expect(
      rail.getByText('Orders', { exact: true }).and(page.locator('[aria-hidden]')),
    ).toBeVisible();
    await expectTableUncut(1024);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: 'captures/a1-rail-collapsed.png' });

    // Remembered on reload.
    await page.reload();
    await expect(rail.getByRole('button', { name: 'Expand menu' })).toBeVisible();
    await expect.poll(width).toBeLessThan(5 * remPx);

    // Kitchen opens from the collapsed panel.
    await rail.getByRole('link', { name: 'Kitchen' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Kitchen');
    await page.screenshot({ path: 'captures/a1-kitchen.png' });

    // Expand again, leave the state as it was found.
    await rail.getByRole('button', { name: 'Expand menu' }).click();
    await expect.poll(width).toBeGreaterThan(8 * remPx);
    await expect(rail.getByRole('button', { name: 'Collapse menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
