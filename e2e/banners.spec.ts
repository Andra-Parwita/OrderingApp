/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';
import { collectErrors, pageScrollWidth } from './sellerHelpers';

// Stage 4.9 (D-038): images are never cropped, except that the wide banner fills its strip (plan 040);
// the rail shows its image, or its icon when collapsed (the seller's initial without one); the orders table fits 1024 px.
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

test('banner fills its strip, rail and customer images show whole', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one run, on the desktop project');
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL;

  const open = async (width: number, height: number) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height } });
    const page = await context.newPage();
    return { context, page, errors: collectErrors(page) };
  };

  // Desktop banner (plan 040, D-093): the image fills the content width, cover, no side bands, as
  // tall as the left menu's top (164 px); narrower than iPad landscape it gets shorter instead.
  for (const [width, height, capture] of [
    [1180, 820, 'captures/banners3-desktop-1180.png'],
    [1366, 768, 'captures/banners3-desktop-1366.png'],
    [1920, 1080, 'captures/banners3-desktop-1920.png'],
    [820, 1180, 'captures/banners3-desktop-820.png'],
  ] as const) {
    const { context, page, errors } = await open(width, height);
    try {
      await page.goto('/seller/orders');
      const image = await loaded(page, alt);
      expect(await image.evaluate((img) => getComputedStyle(img).objectFit)).toBe('cover');
      const imageBox = await image.boundingBox();
      const rail = page.getByRole('navigation', { name: 'Seller' });
      const railBox = await rail.boundingBox();
      const contentWidth = width - (railBox?.width ?? 0) - 1; // the rail's right hairline
      // No side bands: the picture spans the whole content width.
      expect(Math.abs((imageBox?.width ?? 0) - contentWidth)).toBeLessThan(2);
      const expected = Math.min(164, (contentWidth * 328) / 1896);
      expect(Math.abs((imageBox?.height ?? 0) - expected)).toBeLessThan(1.5);
      if (width !== 820) expect(Math.round(imageBox?.height ?? 0)).toBe(164);
      // The slot sits on the seller's colour only as a loading fallback.
      expect(await colourOf(image.locator('xpath=..'))).toBe(BACKGROUND);
      if (width === 1920) {
        const strip = image.locator('xpath=../../../..'); // slot > full > clip > strip
        const backdrop = await strip.evaluate((el) => getComputedStyle(el).backgroundImage);
        expect(backdrop).toContain('/samples/banner-bg.jpg');
      }
      await page.screenshot({ path: capture });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }

  // Rail: the 2:1 image expanded; collapsed, the seller's initial named by the kitchen.
  {
    const { context, page, errors } = await open(1280, 800);
    try {
      await page.goto('/seller/orders');
      const rail = page.getByRole('navigation', { name: 'Seller' });
      const railImage = rail.getByRole('img');
      await expect(railImage).toHaveAttribute('src', '/samples/rail.png');
      const box = await railImage.boundingBox();
      // Fills its block edge to edge: 232 x 116, the kitchen name below it (164 px in all).
      expect(Math.abs((box?.width ?? 0) - 232)).toBeLessThan(1);
      expect(Math.abs((box?.height ?? 0) - 116)).toBeLessThan(1);
      await rail.getByRole('button', { name: 'Collapse menu' }).click();
      // The owner's rail icon (D-040) takes the place of the initial.
      const icon = rail.getByRole('img', { name: 'Onde Onde' });
      await expect(icon).toHaveAttribute('src', '/samples/icon-512.jpg');
      await expect(rail.getByText(/coming soon$/)).toHaveCount(0);
      // The rail narrows over 150 ms; measure and capture it once it has.
      await expect.poll(async () => (await rail.boundingBox())?.width ?? 999).toBeLessThan(73);
      const initialBox = await icon.boundingBox();
      expect(Math.abs((initialBox?.width ?? 0) - 72)).toBeLessThan(1);
      expect(Math.abs((initialBox?.height ?? 0) - 72)).toBeLessThan(1);
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
      // Orders on a phone (under 600 px): the 3:1 phone banner above the list.
      await page.goto('/seller/orders');
      const image = await loaded(page, alt);
      await expect(image).toHaveAttribute('src', '/samples/banner-phone-3x1.jpg');
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
      await markHowItWorksSeen(context);
      await page.goto('/onde-onde');
      const image = await loaded(page, alt);
      await expect(image).toHaveAttribute('src', '/samples/banner-phone-3x1.jpg');
      await showsWholeImage(image);
      expect(await colourOf(image.locator('xpath=..'))).toBe(BACKGROUND);
      await page.screenshot({ path: 'captures/banners2-customer.png' });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

test('the orders list fits 1024 px with long names, panel open and collapsed', async ({
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
    const created = await request.post('/api/s/onde-onde/orders', {
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
    await page.goto('/seller/orders');
    await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
    const rows = page.getByRole('button', { name: new RegExp(stamp) });
    await expect(rows).toHaveCount(names.length);
    const list = rows.first().locator('xpath=..');

    const fits = async () => {
      expect(await pageScrollWidth(page)).toBeLessThanOrEqual(1024);
      const box = await list.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1024);
      // Names wrap rather than truncate: each full name is shown and none is cut off.
      for (const name of names) {
        const cell = page.getByText(name, { exact: true });
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

test('scrolling the orders list slides the sheet over the banner, which keeps its size', async ({
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one run, on the desktop project');
  const baseURL = testInfo.project.use.baseURL;
  // Dapur Demo has room for 50 sample orders (see seller-list-scroll), so the list scrolls.
  const sampled = await request.post('/api/dev/sample-orders', {
    headers: { 'X-Seller': 'dapur-demo' },
    data: { count: 50 },
  });
  expect(sampled.ok()).toBe(true);
  const context = await browser.newContext({ baseURL, viewport: { width: 1180, height: 820 } });
  try {
    await context.addInitScript(() => localStorage.setItem('devSeller', 'dapur-demo'));
    const page = await context.newPage();
    await page.goto('/seller/orders');
    const image = page.locator('img[src*="banner-wide"]');
    await expect(image).toBeVisible();
    const clip = image.locator('xpath=../../..'); // slot > full > clip
    const rail = page.getByRole('navigation', { name: 'Seller' });
    const height = async (locator: Locator) =>
      Math.round((await locator.boundingBox())?.height ?? 0);
    await expect.poll(() => height(clip)).toBe(164);
    // Scroll the first element that actually scrolls inside the sheet.
    const scrolled = await page.evaluate(() => {
      const target = [...document.querySelectorAll<HTMLElement>('div')].find(
        (el) => getComputedStyle(el).overflowY === 'auto' && el.scrollHeight > el.clientHeight + 40,
      );
      if (!target) return false;
      target.scrollTop = 60;
      return true;
    });
    expect(scrolled).toBe(true);
    await expect.poll(() => height(clip)).toBe(73);
    expect(Math.round((await image.boundingBox())?.height ?? 0)).toBe(164);
    await page.screenshot({ path: 'captures/banners3-scrolled-1180.png' });
    await page.evaluate(() => {
      for (const el of document.querySelectorAll<HTMLElement>('div')) el.scrollTop = 0;
    });
    await expect.poll(() => height(clip)).toBe(164);
    await rail.getByRole('button', { name: 'Collapse menu' }).click();
    await expect.poll(async () => (await rail.boundingBox())?.width ?? 999).toBeLessThan(80);
    // The banner follows the menu: 73 px strip, image still 164.
    await expect.poll(() => height(clip)).toBe(73);
    expect(Math.round((await image.boundingBox())?.height ?? 0)).toBe(164);
    await page.screenshot({ path: 'captures/banners3-rail-collapsed-1180.png' });
    await rail.getByRole('button', { name: 'Expand menu' }).click();
    await expect.poll(() => height(clip)).toBe(164);
  } finally {
    await context.close();
  }
});
