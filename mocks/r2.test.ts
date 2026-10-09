// @vitest-environment node
// Stage 8.3: the image helpers against wrangler's LOCAL R2 (a simulated bucket on disk). The
// persist directory is asserted to be a scratch directory before anything is opened, and --remote
// is never used, so nothing here can reach a real bucket.
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { slotSpec } from '../shared/imageSlots';
import { deleteImageRefs, putUploadedImage, type ImageBucket } from '../worker/images/r2';
import { IMAGE_CACHE_CONTROL, serveImage } from '../worker/images/serve';
import { fakePng } from './images';

const SCRATCH = path.resolve('scratch', 'r2-tests');
const DIR = path.resolve(SCRATCH, 'r2-local');

// wrangler is loaded by a variable name on purpose (see mocks/impl.ts).
type Proxy = { env: Record<string, unknown>; dispose: () => Promise<void> };
type Wrangler = {
  getPlatformProxy: (options: { configPath: string; persist: { path: string } }) => Promise<Proxy>;
};
const WRANGLER = 'wrangler';

describe('local R2 bucket', () => {
  let proxy: Proxy | undefined;
  let bucket: ImageBucket;

  beforeAll(async () => {
    if (
      path.relative(SCRATCH, DIR) !== 'r2-local' ||
      !DIR.includes(`${path.sep}scratch${path.sep}`)
    ) {
      throw new Error(`Refusing to use ${DIR} as a test bucket directory`);
    }
    rmSync(DIR, { recursive: true, force: true });
    mkdirSync(DIR, { recursive: true });
    const { getPlatformProxy } = (await import(/* @vite-ignore */ WRANGLER)) as Wrangler;
    proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc', persist: { path: DIR } });
    bucket = proxy.env['IMAGES'] as ImageBucket;
  }, 60_000);

  afterAll(async () => {
    await proxy?.dispose();
    rmSync(DIR, { recursive: true, force: true });
  }, 30_000);

  const { width, height } = slotSpec('desktopBanner');

  it('puts, serves with cache headers, and deletes', async () => {
    const stored = await putUploadedImage(
      bucket,
      'seller-test',
      'desktopBanner',
      fakePng(width, height, 100),
    );
    expect(stored?.key).toMatch(/^sellers\/seller-test\/desktopBanner-[0-9a-f]{16}\.png$/);
    if (!stored) return;

    const response = await serveImage(bucket, new Request(`https://delave.test${stored.ref}`));
    expect(response?.status).toBe(200);
    expect(response?.headers.get('Cache-Control')).toBe(IMAGE_CACHE_CONTROL);
    expect(response?.headers.get('Content-Type')).toBe('image/png');
    const etag = response?.headers.get('ETag');
    expect(etag).toBeTruthy();
    const bytes = new Uint8Array((await response?.arrayBuffer()) ?? new ArrayBuffer(0));
    expect(bytes.length).toBe(24 + 100);
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

    const cached = await serveImage(
      bucket,
      new Request(`https://delave.test${stored.ref}`, { headers: { 'If-None-Match': etag ?? '' } }),
    );
    expect(cached?.status).toBe(304);

    await deleteImageRefs(bucket, [stored.ref], 'seller-test');
    expect(
      (await serveImage(bucket, new Request(`https://delave.test${stored.ref}`)))?.status,
    ).toBe(404);
    expect(await bucket.get(stored.key)).toBeNull();
  });
});
