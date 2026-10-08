import { expect, test } from '@playwright/test';
import { collectErrors, pageScrollWidth, searchBox } from './sellerHelpers';

// Stage 4.7: the collapsible rail (D-032), equal-width "who ordered" chips (D-033) and a table
// whose key identifiers never truncate. Desktop only; orders are found by a unique name.
test('seller desktop: collapsible rail, equal cook-list chips, nothing cut in the table', async ({
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one run, on the desktop project');
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL;
  const stamp = Date.now();
  const names = [`Wi-${stamp}`, `Maximiliana-Wijayakusuma-${stamp}`, `Tom-${stamp}`];
  for (const firstName of names) {
    const created = await request.post('/api/orders', {
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
      await searchBox(page).fill(String(stamp));
      const rows = page
        .getByRole('table', { name: 'Orders' })
        .getByRole('row')
        .filter({
          hasText: String(stamp),
        });
      await expect(rows).toHaveCount(3);
      expect(await pageScrollWidth(page), `page width at ${viewport}`).toBeLessThanOrEqual(
        viewport,
      );
      const cutCells: unknown = await page.evaluate(
        `Array.from(document.querySelectorAll('tbody tr'))
          .filter((row) => row.textContent.includes('${stamp}'))
          .flatMap((row) => [0, 1, 3, 4, 5].map((i) => row.children[i]))
          .filter((cell) => cell.scrollWidth > cell.clientWidth).length`,
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
    await expect.poll(width).toBeLessThan(4 * remPx);
    await expect(rail.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await rail.getByRole('link', { name: 'Cook list' }).focus();
    await expect(
      rail.getByText('Cook list', { exact: true }).and(page.locator('[aria-hidden]')),
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
    await expect.poll(width).toBeLessThan(4 * remPx);

    // The cook list: every "who ordered" chip is the same width.
    await rail.getByRole('link', { name: 'Cook list' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cook list');
    const chips = page.getByRole('list', { name: 'Who ordered' }).getByRole('listitem');
    await expect(chips.filter({ hasText: String(stamp) })).toHaveCount(3);
    const widths: Array<number> = [];
    for (let i = 0; i < (await chips.count()); i += 1) {
      const box = await chips.nth(i).boundingBox();
      widths.push(Math.round((box?.width ?? 0) * 10) / 10);
    }
    expect(widths.length).toBeGreaterThanOrEqual(3);
    expect(new Set(widths).size, `chip widths ${widths.join(', ')}`).toBe(1);
    await expect(chips.filter({ hasText: `Wi-${stamp}` })).toContainText('\u00d71');
    await page.screenshot({ path: 'captures/a1-cook-chips.png' });

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
