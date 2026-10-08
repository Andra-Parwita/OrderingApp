/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { collectErrors, pageScrollWidth } from './sellerHelpers';

// Stage 4.9 (D-038): images are never cropped; the seller's colour fills the sides of the banner;
// the rail shows its image, or the seller's initial when collapsed; the orders table fits 1024 px.
const alt = 'Onde Onde — Indonesian homemade food';
const BACKGROUND = 'rgb(131, 89, 55)'; // #835937

const loaded = async (page: Page, name: string) => {
  const image = page.getByRole('img', { name });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0)))
    .toBeGreaterThan(0);
  return image;
};

/** With object-fit: contain the drawn picture keeps its own shape, whatever the box is. */
async function showsWholeImage(image: Locator): Promise<void> {
  const shown = await image.evaluate((img: HTMLImageElement) => {
    const box = img.getBoundingClientRect();
    const natural = img.naturalWidth / img.naturalHeight;
    const boxRatio = box.width / box.height;
    const drawnWidth = boxRatio > natural ? box.height * natural : box.width;
    const drawnHeight = boxRatio > natural ? box.height : box.width / natural;
    return {
      fit: getComputedStyle(img).objectFit,
      drawn: drawnWidth / drawnHeight,
      natural,
      drawnWidth,
      boxWidth: box.width,
    };
  });
  expect(shown.fit).toBe('contain');
  expect(Math.abs(shown.drawn / shown.natural - 1)).toBeLessThan(0.02);
  expect(shown.drawnWidth).toBeLessThanOrEqual(shown.boxWidth + 1);
}

const colourOf = (locator: Locator): Promise<string> =>
  locator.evaluate((el) => getComputedStyle(el).backgroundColor);

test('banner, rail and customer images are never cropped', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one run, on the desktop project');
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL;

  const open = async (width: number, height: number) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height } });
    const page = await context.newPage();
    return { context, page, errors: collectErrors(page) };
  };

  // Desktop banner: the whole image, with the seller's colour beside it, at 1280, 1366 and 1920.
  for (const [width, height, capture] of [
    [1280, 800, null],
    [1366, 768, 'captures/banners2-desktop-1366.png'],
    [1920, 1080, 'captures/banners2-desktop-1920.png'],
  ] as const) {
    const { context, page, errors } = await open(width, height);
    try {
      await page.goto('/seller');
      const image = await loaded(page, alt);
      await showsWholeImage(image);
      const slot = image.locator('xpath=..');
      expect(await colourOf(slot)).toBe(BACKGROUND);
      const strip = slot.locator('xpath=../..');
      expect(await colourOf(strip)).toBe(BACKGROUND);
      const stripBox = await strip.boundingBox();
      const slotBox = await slot.boundingBox();
      expect(slotBox?.width ?? 0).toBeLessThanOrEqual(1600 + 1);
      // 5:1, so the height follows the width: nothing caps it and forces a crop.
      expect(Math.abs((slotBox?.width ?? 0) / (slotBox?.height ?? 1) - 5)).toBeLessThan(0.05);
      if (width === 1920) {
        // Wider than the 1600 px image area: the colour shows on both sides of it.
        expect((stripBox?.width ?? 0) - (slotBox?.width ?? 0)).toBeGreaterThan(50);
      }
      if (capture) await page.screenshot({ path: capture });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }

  // Rail: the 2:1 image expanded; collapsed, the seller's initial named by the kitchen.
  {
    const { context, page, errors } = await open(1280, 800);
    try {
      await page.goto('/seller');
      const rail = page.getByRole('navigation', { name: 'Seller' });
      const railImage = rail.getByRole('img');
      await expect(railImage).toHaveAttribute('src', '/samples/rail.jpg');
      const box = await railImage.boundingBox();
      expect(Math.abs((box?.width ?? 0) / (box?.height ?? 1) - 2)).toBeLessThan(0.05);
      await rail.getByRole('button', { name: 'Collapse menu' }).click();
      const initial = rail.getByRole('img', { name: 'Delave' });
      await expect(initial).toHaveText('D');
      await expect(rail.getByText(/coming soon$/)).toHaveCount(0);
      const initialBox = await initial.boundingBox();
      expect(Math.abs((initialBox?.width ?? 0) - 40)).toBeLessThan(1);
      expect(Math.abs((initialBox?.height ?? 0) - 40)).toBeLessThan(1);
      // The rail narrows over 150 ms; capture it once it has.
      await expect.poll(async () => (await rail.boundingBox())?.width ?? 999).toBeLessThan(80);
      await page.screenshot({ path: 'captures/banners2-rail-collapsed.png' });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }

  // Phone, 390 px: the phone banner, whole, on the colour.
  {
    const { context, page, errors } = await open(390, 844);
    try {
      // The settings page: the order list's width depends on whatever orders other specs placed.
      await page.goto('/seller/settings');
      const image = await loaded(page, alt);
      await expect(image).toHaveAttribute('src', '/samples/banner-phone.jpg');
      await showsWholeImage(image);
      expect(await colourOf(image.locator('xpath=..'))).toBe(BACKGROUND);
      expect(await pageScrollWidth(page)).toBeLessThanOrEqual(390);
      await page.screenshot({ path: 'captures/banners2-phone.png' });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }

  // Customer menu: the same phone banner on top, whole.
  {
    const { context, page, errors } = await open(390, 844);
    try {
      await page.goto('/');
      const image = await loaded(page, alt);
      await expect(image).toHaveAttribute('src', '/samples/banner-phone.jpg');
      await showsWholeImage(image);
      expect(await colourOf(image.locator('xpath=..'))).toBe(BACKGROUND);
      await page.screenshot({ path: 'captures/banners2-customer.png' });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

test('the orders table fits 1024 px with long names, rail open and collapsed', async ({
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one run, on the desktop project');
  test.setTimeout(90_000);
  const baseURL = testInfo.project.use.baseURL;
  const stamp = String(Date.now()).slice(-6);
  const names = [
    `Maximiliana-Wijayakusuma-${stamp}`,
    `Katarina Setiawati Hadinata ${stamp}`,
    `Wolfeschlegelstein-Berger-${stamp}`,
    `Anastasia Kusumawardhani ${stamp}`,
    `Bartholomeus-Pangaribuan-${stamp}`,
  ];
  for (const [index, firstName] of names.entries()) {
    expect(firstName.length).toBeGreaterThanOrEqual(30);
    const created = await request.post('/api/orders', {
      data: {
        firstName,
        language: 'en',
        lines: [
          { itemId: 'nasi-campur', qty: 3 },
          { itemId: 'ayam-goreng', qty: 2 },
        ],
        fulfilment: 'pickup',
        note: 'Please no chilli',
      },
    });
    expect(created.ok()).toBe(true);
    const { order } = (await created.json()) as { order: { code: string; token: string } };
    // The widest cells: "Edited by customer" in Attention, "Ready for pickup" in Status.
    if (index < 2) {
      const edited = await request.patch(`/api/orders/${order.token}`, {
        data: { note: 'Please no chilli at all' },
      });
      expect(edited.ok()).toBe(true);
    }
    if (index === 2) {
      for (const to of ['confirmed', 'ready_for_pickup']) {
        const moved = await request.post(`/api/seller/orders/${order.code}/status`, {
          data: { to },
        });
        expect(moved.ok()).toBe(true);
      }
    }
  }

  const context = await browser.newContext({ baseURL, viewport: { width: 1024, height: 768 } });
  try {
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto('/seller');
    await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(stamp) })).toHaveCount(names.length);
    const table = page.getByRole('table');

    const fits = async () => {
      expect(await pageScrollWidth(page)).toBeLessThanOrEqual(1024);
      const box = await table.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1024);
      // Names wrap rather than truncate: each full name is shown and none is cut off.
      for (const name of names) {
        const cell = page.getByRole('cell', { name, exact: true });
        await expect(cell).toBeVisible();
        const clipped = await cell.evaluate((td) => td.scrollWidth > td.clientWidth + 1);
        expect(clipped).toBe(false);
      }
    };

    await fits();
    await page.screenshot({ path: 'captures/banners2-table-1024.png' });
    await page
      .getByRole('navigation', { name: 'Seller' })
      .getByRole('button', { name: 'Collapse menu' })
      .click();
    await fits();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
