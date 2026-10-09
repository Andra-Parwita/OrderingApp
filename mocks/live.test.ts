// @vitest-environment node
// Stage 8.3: live events after every write, the live socket's door, and seller images in a bucket.
// Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseCustomerOrderResponse, parseSellerOrderResponse } from '../shared/orderContract';
import { LIVE_PATH, parseLiveSignal, type LiveSignal } from '../shared/liveContract';
import { parseImagesResponse } from '../shared/setupContract';
import { slotSpec } from '../shared/imageSlots';
import { deleteImageRefs, putUploadedImage, type ImageBucket } from '../worker/images/r2';
import { IMAGE_CACHE_CONTROL, serveImage } from '../worker/images/serve';
import { broadcast } from '../worker/live/hub';
import { createLiveNotifier, type RoomNamespace } from '../worker/live/notifier';
import { devApi, useWorld, type World } from './impl';
import type { RouteContext } from '../worker/api/routes';
import { fakePng } from './images';

const NOW = new Date('2026-10-07T10:00:00Z');
const A = 'onde-onde';
const A_ID = 'seller-onde-onde';
const B_ID = 'seller-dapur-demo';

type Sent = { sellerId: string; signal: LiveSignal };

function fakeLive() {
  const sent: Array<Sent> = [];
  const connected: Array<string> = [];
  const live = {
    notify(sellerId: string, signal: LiveSignal) {
      sent.push({ sellerId, signal });
      return Promise.resolve();
    },
    connect(sellerId: string) {
      connected.push(sellerId);
      return Promise.resolve(new Response('room', { headers: { 'X-Room': sellerId } }));
    },
  };
  return { live, sent, connected };
}

/** An in-memory stand-in for the R2 binding. */
function fakeBucket() {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string | undefined }>();
  const bucket: ImageBucket = {
    put(key, value, options) {
      objects.set(key, {
        bytes: value instanceof Uint8Array ? value : new Uint8Array(value),
        contentType: options?.httpMetadata?.contentType,
      });
      return Promise.resolve();
    },
    get(key) {
      const object = objects.get(key);
      if (!object) return Promise.resolve(null);
      return Promise.resolve({
        body: new Blob([object.bytes as Uint8Array<ArrayBuffer>]).stream(),
        httpEtag: `"${key}"`,
        httpMetadata: { contentType: object.contentType },
      });
    },
    delete(key) {
      objects.delete(key);
      return Promise.resolve();
    },
  };
  return { bucket, objects };
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

const png = (slot: Parameters<typeof slotSpec>[0], padding = 0) => {
  const { width, height } = slotSpec(slot);
  return fakePng(width, height, padding);
};

describe('live events and images', () => {
  const create = useWorld('live');
  let world: World;
  let room: ReturnType<typeof fakeLive>;
  let r2: ReturnType<typeof fakeBucket>;
  let counter = 0;

  async function call(
    method: string,
    path: string,
    options: {
      seller?: string;
      body?: unknown;
      headers?: Record<string, string>;
      ctx?: RouteContext;
    } = {},
  ) {
    const headers: Record<string, string> = { ...options.headers };
    if (options.seller) headers['X-Seller'] = options.seller;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
      options.ctx ?? { live: room.live, images: r2.bucket },
    );
    if (!response) return { status: -1, body: null as unknown, response: null };
    const text = await response.clone().text();
    return { status: response.status, body: parseBody(text), response };
  }

  const types = () => room.sent.map((entry) => entry.signal.type);

  async function place(fulfilment: 'pickup' | 'delivery' = 'pickup') {
    const reply = await call('POST', `/api/s/${A}/orders`, {
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment,
        lines: [{ itemId: 'pesmol', qty: 1 }],
      },
    });
    const order = parseCustomerOrderResponse(reply.body)?.order;
    if (reply.status !== 201 || !order) throw new Error(JSON.stringify(reply.body));
    return order;
  }

  beforeEach(async () => {
    counter = 0;
    world = await create({ now: () => NOW, newToken: () => `token-${String((counter += 1))}` });
    room = fakeLive();
    r2 = fakeBucket();
  });

  describe('events after writes', () => {
    it('customer place, change and cancel nudge that seller, with the code only', async () => {
      const order = await place();
      expect(room.sent).toEqual([
        { sellerId: A_ID, signal: { type: 'order.created', code: order.code } },
      ]);
      await call('PATCH', `/api/orders/${order.token}`, { body: { note: 'No chili' } });
      await call('POST', `/api/orders/${order.token}/cancel`);
      expect(types()).toEqual(['order.created', 'order.changed', 'order.changed']);
      expect(room.sent.every((entry) => entry.sellerId === A_ID)).toBe(true);
      // No customer data and no private token ever travels in an event.
      const everything = JSON.stringify(room.sent);
      expect(everything).not.toMatch(/Rina|token-|chili/i);
      for (const entry of room.sent) expect(parseLiveSignal(entry.signal)).toEqual(entry.signal);
    });

    it('seller actions each nudge once', async () => {
      const order = await place('delivery');
      room.sent.length = 0;
      const code = order.code;
      const base = `/api/seller/orders/${code}`;
      const steps: Array<[string, unknown]> = [
        ['status', { to: 'confirmed' }],
        ['paid', { paid: true }],
        ['lock', { locked: true }],
        ['wa-received', { received: true }],
        ['nudge', undefined],
        ['seen', undefined],
      ];
      for (const [step, body] of steps) {
        const before = room.sent.length;
        const reply = await call('POST', `${base}/${step}`, {
          seller: A,
          ...(body !== undefined ? { body } : {}),
        });
        expect(reply.status, step).toBe(200);
        expect(room.sent.slice(before), step).toEqual([
          { sellerId: A_ID, signal: { type: 'order.changed', code } },
        ]);
      }
    });

    it('a seller-made order says created; a bulk update says changed per order', async () => {
      const order = await place();
      room.sent.length = 0;
      const made = await call('POST', '/api/seller/orders', {
        seller: A,
        body: {
          firstName: 'Tono',
          language: 'id',
          fulfilment: 'pickup',
          lines: [{ itemId: 'pesmol', qty: 1 }],
        },
      });
      const madeOrder = parseSellerOrderResponse(made.body)?.order;
      expect(made.status).toBe(201);
      expect(room.sent).toEqual([
        { sellerId: A_ID, signal: { type: 'order.created', code: madeOrder?.code } },
      ]);
      room.sent.length = 0;
      const bulk = await call('POST', '/api/seller/updates', {
        seller: A,
        body: { template: 'ready', codes: [order.code, madeOrder?.code, 'NOPE00'] },
      });
      expect(bulk.status).toBe(200);
      expect(room.sent.map((entry) => entry.signal.code).sort()).toEqual(
        [order.code, madeOrder?.code].sort(),
      );
    });

    it('menu changes say menu.changed; finishing the menu says both', async () => {
      await call('POST', '/api/seller/menus/current/unpublish', { seller: A });
      await call('POST', '/api/seller/menus/current/publish', { seller: A });
      await call('PATCH', '/api/seller/menu/items/pesmol', { seller: A, body: { soldOut: true } });
      expect(types()).toEqual(['menu.changed', 'menu.changed', 'menu.changed']);
      room.sent.length = 0;
      await call('POST', '/api/seller/menus/current/finish', { seller: A });
      expect(types().sort()).toEqual(['menu.changed', 'order.changed']);
    });

    it('sends nothing when the write fails', async () => {
      const order = await place();
      room.sent.length = 0;
      expect(
        (
          await call('POST', `/api/seller/orders/${order.code}/status`, {
            seller: A,
            body: { to: 'delivered' }, // not allowed from the current status
          })
        ).status,
      ).toBe(409);
      expect(
        (await call('POST', '/api/seller/orders/ZZZZZZ/paid', { seller: A, body: { paid: true } }))
          .status,
      ).toBe(404);
      expect(
        (await call('PATCH', '/api/orders/unknown-token', { body: { note: 'x' } })).status,
      ).toBe(404);
      expect(room.sent).toEqual([]);
    });

    it('still answers when the room is unreachable', async () => {
      const broken = {
        notify: () => Promise.reject(new Error('room down')),
        connect: () => Promise.reject(new Error('room down')),
      };
      const reply = await call('POST', `/api/s/${A}/orders`, {
        ctx: { live: broken },
        body: {
          firstName: 'Rina',
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId: 'pesmol', qty: 1 }],
        },
      });
      expect(reply.status).toBe(201);
    });
  });

  describe('the live socket door', () => {
    const upgrade = { Upgrade: 'websocket' };

    it('hands a dev seller (X-Seller or ?seller=) to that seller room only', async () => {
      expect(
        (await call('GET', LIVE_PATH, { seller: 'dapur-demo', headers: upgrade })).status,
      ).toBe(200);
      expect(
        (await call('GET', `${LIVE_PATH}?seller=dapur-demo`, { headers: upgrade })).status,
      ).toBe(200);
      expect((await call('GET', LIVE_PATH, { headers: upgrade })).status).toBe(200);
      expect(room.connected).toEqual([B_ID, B_ID, A_ID]);
    });

    it('refuses a bad session, an unknown seller, and a plain request', async () => {
      const bad = await call('GET', LIVE_PATH, {
        headers: { ...upgrade, Cookie: '__Host-session=not-a-session' },
      });
      expect(bad.status).toBe(401);
      expect((await call('GET', LIVE_PATH, { seller: 'nobody', headers: upgrade })).status).toBe(
        404,
      );
      expect((await call('GET', LIVE_PATH, { seller: A })).status).toBe(426);
      expect((await call('POST', LIVE_PATH, { seller: A, headers: upgrade })).status).toBe(-1);
      expect(room.connected).toEqual([]);
    });

    it('is not offered when the host has no live room', async () => {
      const reply = await call('GET', LIVE_PATH, { headers: upgrade, ctx: {} });
      expect(reply.status).toBe(404);
    });
  });

  describe('images in the bucket', () => {
    const put = (slot: string, body: unknown) =>
      call('PUT', `/api/seller/images/${slot}`, { seller: A, body });
    const imagesOf = (reply: { body: unknown }) => parseImagesResponse(reply.body)?.images ?? {};

    it('stores the bytes under a content-hashed key and keeps only the path', async () => {
      const dataUrl = png('railIcon');
      const reply = await put('railIcon', { dataUrl });
      expect(reply.status).toBe(200);
      const ref = imagesOf(reply).railIcon;
      expect(ref).toMatch(/^\/images\/sellers\/seller-onde-onde\/railIcon-[0-9a-f]{16}\.png$/);
      expect([...r2.objects.keys()]).toEqual([(ref as string).slice('/images/'.length)]);
      expect([...r2.objects.values()][0]?.contentType).toBe('image/png');
      // The same bytes again: the same key, nothing extra in the bucket.
      expect(imagesOf(await put('railIcon', { dataUrl })).railIcon).toBe(ref);
      expect(r2.objects.size).toBe(1);
      // The customer's menu shows that path too.
      const menu = await call('GET', `/api/s/${A}/menu`);
      expect(JSON.stringify(menu.body)).toContain(ref as string);
    });

    it('replacing deletes the old object; removing deletes the last one', async () => {
      const first = imagesOf(await put('railIcon', { dataUrl: png('railIcon') })).railIcon;
      const second = imagesOf(await put('railIcon', { dataUrl: png('railIcon', 40) })).railIcon;
      expect(second).not.toBe(first);
      expect(r2.objects.size).toBe(1);
      expect(r2.objects.has((second as string).slice('/images/'.length))).toBe(true);
      const removed = await call('DELETE', '/api/seller/images/railIcon', { seller: A });
      expect(imagesOf(removed).railIcon).toBeUndefined();
      expect(r2.objects.size).toBe(0);
    });

    it('keeps an object a saved set still shows', async () => {
      const ref = imagesOf(await put('railIcon', { dataUrl: png('railIcon') })).railIcon as string;
      // Sets of dishes no longer carry pictures; a set from an old backup file still does.
      const backup = (await call('GET', '/api/seller/backup', { seller: A })).body as {
        sets: Array<unknown>;
      };
      backup.sets = [{ id: 'old-set', name: 'With icon', items: [], images: { railIcon: ref } }];
      const restored = await call('POST', '/api/seller/backup', { seller: A, body: backup });
      expect(restored.status).toBe(200);
      await call('DELETE', '/api/seller/images/railIcon', { seller: A });
      expect(r2.objects.has(ref.slice('/images/'.length))).toBe(true);
    });

    it('does not store an invalid upload, and answers with the usual error', async () => {
      const wrongShape = await put('railIcon', { dataUrl: png('desktopBanner') });
      expect(wrongShape.status).toBe(400);
      expect((wrongShape.body as { error: string }).error).toBe('image_ratio');
      const notAnImage = await put('railIcon', { dataUrl: 'data:text/plain;base64,aGk=' });
      expect((notAnImage.body as { error: string }).error).toBe('image_type');
      const tooBig = await put('railIcon', { dataUrl: png('railIcon', 700 * 1024) });
      expect((tooBig.body as { error: string }).error).toBe('image_too_big');
      expect(r2.objects.size).toBe(0);
    });

    // Plan 006: image refs stay with their seller.
    const FOREIGN = `/images/sellers/${B_ID}/railIcon-aaaaaaaaaaaaaaaa.png`;
    const FOREIGN_KEY = FOREIGN.slice('/images/'.length);
    const putForeignObject = () =>
      r2.bucket.put(FOREIGN_KEY, new Uint8Array([1, 2, 3]), {
        httpMetadata: { contentType: 'image/png' },
      });
    const backupOf = async () =>
      (await call('GET', '/api/seller/backup', { seller: A })).body as {
        kitchen: { images: Record<string, string> };
        sets: Array<{ images: Record<string, string> }>;
        menu?: { pictureRef?: string };
      };

    it('never deletes another seller object on delete or replace, even from its own row', async () => {
      await putForeignObject();
      const pointAtForeign = () =>
        world.db.batch([
          world.db.stmt(
            "UPDATE kitchen_images SET ref = ? WHERE seller_id = ? AND slot = 'railIcon'",
            FOREIGN,
            A_ID,
          ),
        ]);
      await pointAtForeign();
      expect(
        await call('PUT', '/api/seller/images/railIcon', {
          seller: A,
          body: { dataUrl: png('railIcon') },
        }),
      ).toMatchObject({ status: 200 });
      expect(r2.objects.has(FOREIGN_KEY)).toBe(true);
      await pointAtForeign();
      await call('DELETE', '/api/seller/images/railIcon', { seller: A });
      expect(r2.objects.has(FOREIGN_KEY)).toBe(true);
    });

    it('a restore drops foreign, external and malformed refs, and says how many', async () => {
      const backup = await backupOf();
      backup.kitchen.images['railIcon'] = FOREIGN;
      backup.kitchen.images['desktopBanner'] = 'https://evil.test/x.png';
      backup.sets = [
        { ...(backup.sets[0] ?? {}), images: { phoneBanner: 'javascript:alert(1)' } },
      ] as typeof backup.sets;
      backup.menu = { ...backup.menu, pictureRef: FOREIGN };
      const restored = await call('POST', '/api/seller/backup', { seller: A, body: backup });
      expect(restored.body).toMatchObject({ ok: true, droppedImages: 4 });
      const after = await backupOf();
      expect(after.kitchen.images).not.toHaveProperty('railIcon');
      expect(after.kitchen.images).not.toHaveProperty('desktopBanner');
      expect(after.sets.flatMap((set) => Object.values(set.images))).toEqual([]);
      expect(after.menu?.pictureRef).toBeUndefined();
      expect(JSON.stringify(after)).not.toContain(FOREIGN);
    });

    it('own refs (bucket, menu picture, samples) survive a backup round trip', async () => {
      const icon = imagesOf(await put('railIcon', { dataUrl: png('railIcon') })).railIcon as string;
      const picture = await call('PUT', '/api/seller/menus/current/picture', {
        seller: A,
        body: { dataUrl: png('menuPicture') },
      });
      expect(picture.status).toBe(200);
      const before = await backupOf();
      expect(before.menu?.pictureRef).toMatch(/^\/images\/sellers\/seller-onde-onde\//);
      const restored = await call('POST', '/api/seller/backup', { seller: A, body: before });
      expect(restored.body).toMatchObject({ ok: true, droppedImages: 0 });
      const after = await backupOf();
      expect(after.kitchen.images['railIcon']).toBe(icon);
      expect(after.kitchen.images['desktopBanner']).toBe('/samples/banner-wide.jpg');
      expect(after.menu?.pictureRef).toBe(before.menu?.pictureRef);
    });

    it('leaves dev fixtures (/samples/...) alone and works without a bucket', async () => {
      const menu = await call('GET', `/api/s/${A}/menu`);
      expect(JSON.stringify(menu.body)).toContain('/samples/');
      const removed = await call('DELETE', '/api/seller/images/desktopBanner', { seller: A });
      expect(removed.status).toBe(200);
      expect(r2.objects.size).toBe(0);
      const bare = await call('PUT', '/api/seller/images/railIcon', {
        seller: A,
        body: { dataUrl: png('railIcon') },
        ctx: {},
      });
      expect(imagesOf(bare).railIcon).toMatch(/^data:image\/png;base64,/);
    });
  });
});

describe('serving images', () => {
  it('streams with immutable caching and the right type, 404s the rest', async () => {
    const { bucket } = fakeBucket();
    const stored = await putUploadedImage(bucket, 'seller-x', 'railIcon', png('railIcon'));
    if (!stored) throw new Error('not stored');
    const ok = await serveImage(bucket, new Request(`https://delave.test${stored.ref}`));
    expect(ok?.status).toBe(200);
    expect(ok?.headers.get('Cache-Control')).toBe(IMAGE_CACHE_CONTROL);
    expect(IMAGE_CACHE_CONTROL).toBe('public, max-age=31536000, immutable');
    expect(ok?.headers.get('Content-Type')).toBe('image/png');
    expect((await ok?.arrayBuffer())?.byteLength).toBeGreaterThan(20);

    const etag = ok?.headers.get('ETag') ?? '';
    const again = await serveImage(
      bucket,
      new Request(`https://delave.test${stored.ref}`, { headers: { 'If-None-Match': etag } }),
    );
    expect(again?.status).toBe(304);

    const missing = await serveImage(
      bucket,
      new Request('https://delave.test/images/sellers/seller-x/railIcon-0000000000000000.png'),
    );
    expect(missing?.status).toBe(404);
    for (const path of ['/images/', '/images/sellers/x/evil.html']) {
      expect((await serveImage(bucket, new Request(`https://delave.test${path}`)))?.status).toBe(
        404,
      );
    }
    expect(await serveImage(bucket, new Request('https://delave.test/api/health'))).toBeNull();
    const post = await serveImage(
      bucket,
      new Request(`https://delave.test${stored.ref}`, { method: 'POST' }),
    );
    expect(post?.status).toBe(405);
  });

  it('only deletes refs that are bucket images', async () => {
    const { bucket, objects } = fakeBucket();
    const stored = await putUploadedImage(bucket, 'seller-x', 'railIcon', png('railIcon'));
    await deleteImageRefs(
      bucket,
      ['/samples/banner-wide.jpg', 'data:image/png;base64,AA', undefined],
      'seller-x',
    );
    expect(objects.size).toBe(1);
    // Another seller's ref is skipped; the owner's own ref goes.
    await deleteImageRefs(bucket, [stored?.ref], 'seller-y');
    expect(objects.size).toBe(1);
    await deleteImageRefs(bucket, [stored?.ref], 'seller-x');
    expect(objects.size).toBe(0);
  });
});

describe('the live room', () => {
  const NOW_EVENT = new Date('2026-10-10T08:00:00.000Z');

  it('broadcasts one frame to every open socket and skips a dead one', () => {
    const frames: Array<Array<string>> = [[], [], []];
    const sockets = frames.map((list, index) => ({
      send(data: string) {
        if (index === 1) throw new Error('closed');
        list.push(data);
      },
    }));
    const sent = broadcast(sockets, { type: 'order.created', code: 'K7F2QX' }, NOW_EVENT);
    expect(sent).toBe(2);
    expect(frames[0]).toEqual([
      JSON.stringify({ type: 'order.created', code: 'K7F2QX', at: NOW_EVENT.toISOString() }),
    ]);
    expect(frames[2]).toEqual(frames[0]);
    expect(frames[1]).toEqual([]);
  });

  it('does nothing for an empty room', () => {
    expect(broadcast([], { type: 'menu.changed' }, NOW_EVENT)).toBe(0);
  });

  it('finds the seller room by the seller id, and never forwards the client request', async () => {
    const seen: Array<{
      name: string;
      url: string;
      upgrade: string | null;
      cookie: string | null;
    }> = [];
    const namespace: RoomNamespace = {
      idFromName: (name) => name,
      get: (id: string) => ({
        fetch: (request: Request) => {
          seen.push({
            name: id,
            url: request.url,
            upgrade: request.headers.get('Upgrade'),
            cookie: request.headers.get('Cookie'),
          });
          return Promise.resolve(new Response('ok'));
        },
      }),
    };
    const notifier = createLiveNotifier(namespace);
    await notifier.notify('seller-a', { type: 'order.changed', code: 'K7F2QX' });
    await notifier.connect('seller-b');
    expect(seen).toEqual([
      { name: 'seller-a', url: 'https://live.internal/notify', upgrade: null, cookie: null },
      {
        name: 'seller-b',
        url: 'https://live.internal/connect',
        upgrade: 'websocket',
        cookie: null,
      },
    ]);
  });

  it('swallows a room that is down', async () => {
    const namespace: RoomNamespace = {
      idFromName: (name) => name,
      get: () => ({
        fetch: () => Promise.reject(new Error('down')),
      }),
    };
    await expect(
      createLiveNotifier(namespace).notify('seller-a', { type: 'menu.changed' }),
    ).resolves.toBeUndefined();
  });
});
