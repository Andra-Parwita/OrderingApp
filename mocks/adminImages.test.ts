// @vitest-environment node
// Plan 041: the admin sets a kitchen's pictures. Same checks as the seller's upload, admin only.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseApiError } from '../shared/apiError';
import { parseSessionResponse } from '../shared/authContract';
import { parseMenuResponse } from '../shared/menuContract';
import { handleAdmin } from '../worker/api/authRoutes';
import type { ImageBucket } from '../worker/images/r2';
import { DEV_ADMIN_SETUP_KEY, devApi, useWorld, type World } from './impl';
import { fakePng, pngFor } from './images';
import { SoftAuthenticator } from './softAuthenticator';

const SITE = 'https://delave.test';
const A = 'onde-onde';
const A_ID = 'seller-onde-onde';
const B_ID = 'seller-dapur-demo';

function fakeBucket() {
  const objects = new Map<string, Uint8Array>();
  const bucket: ImageBucket = {
    put(key, value) {
      objects.set(key, value instanceof Uint8Array ? value : new Uint8Array(value));
      return Promise.resolve();
    },
    get: () => Promise.resolve(null),
    delete(key) {
      objects.delete(key);
      return Promise.resolve();
    },
  };
  return { bucket, objects };
}

describe('admin kitchen images', () => {
  const create = useWorld('admin-images');
  let world: World;
  let n = 0;
  const authenticator = new SoftAuthenticator(SITE);

  async function call(method: string, path: string, token?: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (token) headers['Cookie'] = `__Host-session=${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`${SITE}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const text = (await response?.text()) ?? '';
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      // not JSON
    }
    const cookie = response?.headers.get('set-cookie') ?? '';
    return {
      status: response?.status ?? -1,
      body: parsed,
      token: /__Host-session=([^;]+)/.exec(cookie)?.[1] ?? '',
    };
  }

  async function adminToken(): Promise<string> {
    const setup = await call('POST', '/api/admin/setup', undefined, {
      setupKey: DEV_ADMIN_SETUP_KEY,
      deviceId: 'device-aaaa-0001',
    });
    const asked = await call('POST', '/api/auth/register/options', setup.token);
    const options = (asked.body as { options: Record<string, unknown> }).options;
    const done = await call('POST', '/api/auth/register', setup.token, {
      kind: 'passkey',
      deviceName: 'Laptop',
      response: authenticator.create(options as never),
    });
    expect(parseSessionResponse(done.body)).not.toBeNull();
    return done.token;
  }

  async function sellerToken(admin: string): Promise<string> {
    const invite = await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin, {});
    const setup = await call('POST', '/api/auth/invite', undefined, {
      key: (invite.body as { key: string }).key,
      deviceId: 'device-bbbb-0002',
    });
    const full = await call('POST', '/api/auth/register', setup.token, {
      kind: 'password',
      password: 'correct horse battery',
      deviceName: 'Kitchen phone',
    });
    return full.token;
  }

  const menuImages = async (slug: string) =>
    parseMenuResponse((await call('GET', `/api/s/${slug}/menu`)).body)?.kitchen.images;
  const put = (token: string | undefined, id: string, slot: string, dataUrl: unknown) =>
    call('PUT', `/api/admin/sellers/${id}/images/${slot}`, token, { dataUrl });

  beforeEach(async () => {
    authenticator.credentials.length = 0;
    world = await create({
      now: () => new Date('2026-10-07T10:00:00Z'),
      newToken: () => `token-${String((n += 1))}`,
    });
  });

  it('the admin uploads and removes a banner, and the menu shows it', async () => {
    const admin = await adminToken();
    const url = pngFor('desktopBanner');
    const reply = await put(admin, A_ID, 'desktopBanner', url);
    expect(reply.status).toBe(200);
    expect((reply.body as { images: Record<string, string> }).images['desktopBanner']).toBe(url);
    expect((await menuImages(A))?.desktopBanner).toBe(url);
    expect((await call('GET', `/api/admin/sellers/${A_ID}/images`, admin)).status).toBe(200);
    const removed = await call('DELETE', `/api/admin/sellers/${A_ID}/images/desktopBanner`, admin);
    expect(removed.status).toBe(200);
    expect((await menuImages(A))?.desktopBanner).toBeUndefined();
  });

  it('the admin uploads a 1200 x 600 phone banner (plan 123) and a wrong shape is refused', async () => {
    const admin = await adminToken();
    const tall = fakePng(1200, 600, 20);
    const reply = await put(admin, A_ID, 'phoneBanner', tall);
    expect(reply.status).toBe(200);
    expect((await menuImages(A))?.phoneBanner).toBe(tall);
    const wrong = await put(admin, A_ID, 'phoneBanner', fakePng(1200, 800));
    expect(wrong.status).toBe(400);
    expect(parseApiError(wrong.body)?.error).toBe('image_ratio');
    expect((await menuImages(A))?.phoneBanner).toBe(tall);
  });

  it('refuses a seller, an anonymous caller and a missing kitchen', async () => {
    const admin = await adminToken();
    const seller = await sellerToken(admin);
    const url = pngFor('railIcon');
    const before = (await menuImages(A))?.railIcon;
    expect((await put(seller, A_ID, 'railIcon', url)).status).toBe(403);
    expect((await put(undefined, A_ID, 'railIcon', url)).status).toBe(401);
    expect(
      (await call('DELETE', `/api/admin/sellers/${A_ID}/images/railIcon`, seller)).status,
    ).toBe(403);
    expect((await put(admin, 'seller-nope', 'railIcon', url)).status).toBe(404);
    expect((await menuImages(A))?.railIcon).toBe(before);
  });

  it('refuses a wrong type, shape, size and slot like the seller route does', async () => {
    const admin = await adminToken();
    const code = async (dataUrl: unknown, slot = 'railIcon') => {
      const reply = await put(admin, A_ID, slot, dataUrl);
      return [reply.status, parseApiError(reply.body)?.error];
    };
    expect(await code('data:image/gif;base64,R0lGODlh')).toEqual([400, 'image_type']);
    expect(await code(fakePng(128, 64))).toEqual([400, 'image_ratio']);
    expect(await code(fakePng(1600, 320, 600 * 1024), 'desktopBanner')).toEqual([
      400,
      'image_too_big',
    ]);
    expect(await code(pngFor('railIcon'), 'logo')).toEqual([404, 'not_found']);
  });

  it('with a bucket: stored under the seller prefix, and replacing deletes the old object', async () => {
    const admin = await adminToken();
    const { bucket, objects } = fakeBucket();
    const send = (method: string, slot: string, dataUrl?: string) =>
      handleAdmin(
        world.repo,
        new Request(`${SITE}/api/admin/sellers/${B_ID}/images/${slot}`, {
          method,
          headers: { Cookie: `__Host-session=${admin}`, 'Content-Type': 'application/json' },
          ...(dataUrl ? { body: JSON.stringify({ dataUrl }) } : {}),
        }),
        ['sellers', B_ID, 'images', slot, undefined],
        true,
        bucket,
      );
    const first = await send('PUT', 'railIcon', pngFor('railIcon'));
    expect(first?.status).toBe(200);
    expect([...objects.keys()]).toHaveLength(1);
    expect([...objects.keys()][0]).toMatch(new RegExp(`^sellers/${B_ID}/railIcon-`));
    const second = await send('PUT', 'railIcon', pngFor('railIcon', 10));
    expect(second?.status).toBe(200);
    expect(objects.size).toBe(1);
    expect((await send('DELETE', 'railIcon'))?.status).toBe(200);
    expect(objects.size).toBe(0);
    expect((await send('PUT', 'railIcon', fakePng(128, 64)))?.status).toBe(400);
    expect(objects.size).toBe(0);
  });
});
