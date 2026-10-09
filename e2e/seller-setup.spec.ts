import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { collectErrors, isDesktopProject } from './sellerHelpers';

// Stage 6.2b: week settings, pictures and chefs, through the harness (no routes until 6.3).
// Runs on the Android phone and the desktop only. Each project edits its own sample seller (the
// desktop uses Onde Onde, the phone Dapur Demo), so they never touch each other's data, and
// each test puts back what it changed.

test.skip(({ browserName }) => browserName !== 'chromium', 'Android (Chromium) and desktop only');

const sellerFor = (project: string) => (isDesktopProject(project) ? 'onde-onde' : 'dapur-demo');

async function open(page: Page, seller: string, screen: 'week' | 'images' | 'chefs') {
  await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), seller);
  await page.goto(`/?harness=seller-setup&screen=${screen}`);
}

// ---- A real small PNG, made here (no fixture file needed) ----

function crc32(bytes: Buffer): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ~crc >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
/** A solid-colour RGB PNG of the given size. */
function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill([r, g, b]).flat())]);
  const raw = Buffer.concat(Array(height).fill(row) as Array<Buffer>);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Putting things back ----

const as = (seller: string) => ({ headers: { 'X-Seller': seller } });

async function restoreIcon(
  request: APIRequestContext,
  seller: string,
  original: string | undefined,
) {
  if (original === undefined) {
    await request.delete('/api/seller/images/railIcon', as(seller));
    return;
  }
  let dataUrl = original;
  if (!original.startsWith('data:')) {
    const file = await request.get(original);
    dataUrl = `data:image/png;base64,${(await file.body()).toString('base64')}`;
  }
  await request.put('/api/seller/images/railIcon', { ...as(seller), data: { dataUrl } });
}

test('week settings: change the pickup directions and save', async ({
  page,
  request,
}, testInfo) => {
  const errors = collectErrors(page);
  const seller = sellerFor(testInfo.project.name);
  const before = (await (await request.get('/api/seller/week', as(seller))).json()) as {
    week: Record<string, unknown>;
  };
  try {
    await open(page, seller, 'week');
    const directions = page.getByLabel('Directions (English)');
    await expect(page.getByLabel('Pickup place')).not.toHaveValue('');
    await expect(page.getByText(/^Ordering closes automatically at /)).toBeVisible();
    const text = `Ring the bell at the side gate (${testInfo.project.name})`;
    await directions.fill(text);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Directions (English)')).toHaveValue(text);
    await page.screenshot({
      path: `captures/seller-setup-week-${testInfo.project.name}.png`,
      fullPage: true,
    });
  } finally {
    const { cookingDate, cutoffAt, pickupPoints, delivery } = before.week;
    await request.put('/api/seller/week', {
      ...as(seller),
      data: { cookingDate, cutoffAt, pickupPoints, delivery },
    });
  }
  expect(errors).toEqual([]);
});

test('pictures: upload a small icon and see it in the preview', async ({
  page,
  request,
}, testInfo) => {
  const errors = collectErrors(page);
  const seller = sellerFor(testInfo.project.name);
  const before = (await (await request.get('/api/seller/images', as(seller))).json()) as {
    images: { railIcon?: string };
  };
  try {
    await open(page, seller, 'images');
    await expect(page.getByRole('heading', { name: 'Small icon (closed menu)' })).toBeVisible();
    await expect(page.getByText('Best size 128 × 128 px')).toBeVisible();

    await page.getByLabel('Choose a picture for Small icon (closed menu)').setInputFiles({
      name: 'icon.png',
      mimeType: 'image/png',
      buffer: solidPng(128, 128, [200, 90, 40]),
    });
    const preview = page.getByAltText('Preview of Small icon (closed menu)', { exact: true });
    const imageSrc = /^\/images\/sellers\/[^/]+\/railIcon-[0-9a-f]{16}\.(jpg|png)$/;
    await expect(preview).toHaveAttribute('src', imageSrc);
    const railIcon = page.getByAltText('Small icon (closed menu)', { exact: true });
    await expect(railIcon).toHaveAttribute('src', imageSrc);
    const src = (await preview.getAttribute('src')) as string;
    const served = await page.request.get(src);
    expect(served.status()).toBe(200);
    expect(served.headers()['content-type']).toMatch(/^image\//);
    await expect
      .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await page.screenshot({
      path: `captures/seller-setup-images-${testInfo.project.name}.png`,
      fullPage: true,
    });
  } finally {
    await restoreIcon(request, seller, before.images.railIcon);
  }
  expect(errors).toEqual([]);
});

test('chefs: add and rename a chef', async ({ page, request }, testInfo) => {
  const errors = collectErrors(page);
  const seller = sellerFor(testInfo.project.name);
  const name = `Chef E2E ${testInfo.project.name}`;
  const renamed = `${name} B`;
  try {
    await open(page, seller, 'chefs');
    await expect(page.getByRole('heading', { name: 'Chefs' })).toBeVisible();
    await page.getByLabel('Chef name').fill(name);
    await page.getByRole('button', { name: 'Add chef', exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    const row = page.getByRole('listitem').filter({ hasText: name });
    await row.getByRole('button', { name: 'Rename' }).click();
    await page.getByLabel(`New name for ${name}`).fill(renamed);
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByText(renamed, { exact: true })).toBeVisible();
    await page.screenshot({
      path: `captures/seller-setup-chefs-${testInfo.project.name}.png`,
      fullPage: true,
    });
  } finally {
    const list = (await (await request.get('/api/seller/chefs', as(seller))).json()) as {
      chefs: Array<{ id: string; name: string }>;
    };
    for (const chef of list.chefs) {
      if (chef.name === name || chef.name === renamed) {
        await request.delete(`/api/seller/chefs/${chef.id}`, as(seller));
      }
    }
  }
  expect(errors).toEqual([]);
});
