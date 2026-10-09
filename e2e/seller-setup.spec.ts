import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { collectErrors, isDesktopProject } from './sellerHelpers';

// Settings panes (plan 001 stage 10): pickup locations, pictures and chefs, on their real routes
// /seller/settings/:pane. They are tablet and computer screens (a phone shows "Open this on a
// tablet or computer"), so only the wide chromium projects run them. Each test puts back what it
// changed.

test.skip(
  ({ browserName, viewport }) => browserName !== 'chromium' || (viewport?.width ?? 0) < 600,
  'tablet and desktop (Chromium) only',
);

const sellerFor = (project: string) => (isDesktopProject(project) ? 'onde-onde' : 'dapur-demo');

async function open(page: Page, seller: string, pane: 'kitchen' | 'pickup' | 'chefs') {
  await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), seller);
  await page.goto(`/seller/settings/${pane}`);
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

test('pickup locations: change the directions of a place and save', async ({
  page,
  request,
}, testInfo) => {
  const errors = collectErrors(page);
  const seller = sellerFor(testInfo.project.name);
  type Place = { id: string; place: string; directions: unknown; window: unknown };
  const before = (await (await request.get('/api/seller/pickup-places', as(seller))).json()) as {
    places: Array<Place>;
  };
  const first = before.places[0];
  if (!first) throw new Error('the sample kitchen has no pickup place');
  try {
    await open(page, seller, 'pickup');
    await expect(page.getByRole('heading', { name: 'Pickup locations' })).toBeVisible();
    await page.getByRole('button', { name: `Edit ${first.place}` }).click();
    const text = `Ring the bell at the side gate (${testInfo.project.name})`;
    await page.getByLabel('Directions (English)').fill(text);
    await page.getByRole('button', { name: 'Save place' }).click();
    await expect(page.getByRole('button', { name: 'Save place' })).toHaveCount(0);
    await expect(page.getByText(text)).toBeVisible();
    await page.reload();
    await expect(page.getByText(text)).toBeVisible();
    await page.screenshot({
      path: `captures/seller-setup-pickup-${testInfo.project.name}.png`,
      fullPage: true,
    });
  } finally {
    await request.patch(`/api/seller/pickup-places/${first.id}`, {
      ...as(seller),
      data: { place: first.place, directions: first.directions, window: first.window },
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
    await open(page, seller, 'kitchen');
    await expect(page.getByRole('heading', { name: 'Small icon (closed menu)' })).toBeVisible();
    await expect(page.getByText('Best size 512 × 512 px')).toBeVisible();

    await page.getByLabel('Choose a picture for Small icon (closed menu)').setInputFiles({
      name: 'icon.png',
      mimeType: 'image/png',
      buffer: solidPng(512, 512, [200, 90, 40]),
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
    await expect(page.getByRole('heading', { name: 'Chefs', level: 2 })).toBeVisible();
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
