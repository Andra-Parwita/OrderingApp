// @vitest-environment node
// Plan 004 stage 6: web push subscriptions per order, sending after the write, the kitchen manifest
// and icons, and `paid` for customers. Runs against a local D1; the push sender is a stand-in.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCustomerOrderResponse } from '../shared/orderContract';
import type { PushPayload } from '../shared/pushContract';
import { checkOrigin } from '../worker/auth/origin';
import { Db } from '../worker/db/d1';
import { handleKitchenRequest } from '../worker/api/kitchenRoutes';
import { createPushDispatcher, type CustomerChange } from '../worker/push/dispatch';
import {
  realVapidValue,
  vapidFromEnv,
  type PushSender,
  type PushTarget,
} from '../worker/push/sender';
import { devApi, useWorld, type World } from './impl';

const START = new Date('2026-10-07T10:00:00Z');
const KEYS = { p256dh: 'BPublicKeyOfTheBrowser_abc-123', auth: 'AuthSecret_xyz-789' };
const endpointOf = (n: number) => `https://push.example.test/send/secret-endpoint-${String(n)}`;

type Sent = { target: PushTarget; payload: PushPayload };

describe('web push and kitchen files', () => {
  const create = useWorld('push');
  let world: World;
  let sent: Array<Sent>;
  let statusFor: (target: PushTarget) => number | 'throw';
  let logs: Array<string>;
  let dispatcher: ReturnType<typeof createPushDispatcher>;
  let collect: (changes: Array<CustomerChange>) => void;
  let tokenCounter = 0;

  const sender: PushSender = (target, payload) => {
    sent.push({ target, payload });
    const status = statusFor(target);
    if (status === 'throw') return Promise.reject(new Error('network down'));
    return Promise.resolve(status);
  };

  async function call(method: string, path: string, body?: unknown, origin = true) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (origin) headers['Origin'] = 'https://delave.test';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    return { status: response?.status ?? -1, body: (await response?.json()) as unknown };
  }

  /** A customer order; returns its token and code. */
  async function place(
    name: string,
    extra: { language?: 'en' | 'id'; fulfilment?: 'pickup' | 'delivery'; place?: string } = {},
  ) {
    const reply = await call('POST', '/api/s/onde-onde/orders', {
      firstName: name,
      language: extra.language ?? 'en',
      fulfilment: extra.fulfilment ?? 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
      ...(extra.place !== undefined ? { pickupPlaceId: extra.place } : {}),
    });
    const order = parseCustomerOrderResponse(reply.body)?.order;
    if (reply.status !== 201 || !order) throw new Error(JSON.stringify(reply));
    return { token: order.token, code: order.code };
  }

  const subscribe = (token: string, n = 1) =>
    call('POST', `/api/orders/${token}/push`, { endpoint: endpointOf(n), keys: KEYS });
  const subscriptions = () =>
    world.db.all<{ endpoint: string; order_id: string }>(
      'SELECT endpoint, order_id FROM push_subscriptions ORDER BY endpoint',
    );
  const seller = (path: string, body: unknown) => call('POST', `/api/seller${path}`, body);
  const flush = () => dispatcher.flush();

  beforeEach(async () => {
    tokenCounter = 0;
    sent = [];
    logs = [];
    statusFor = () => 201;
    collect = () => undefined;
    world = await create({
      now: () => START,
      newToken: () => `token-${String(++tokenCounter)}-padding-padding`,
      onCustomerChange: (changes) => {
        collect(changes);
      },
    });
    dispatcher = createPushDispatcher({
      db: world.db,
      sender,
      log: (line) => logs.push(line),
    });
    collect = dispatcher.collect;
  });

  afterEach(() => vi.restoreAllMocks());

  describe('subscriptions', () => {
    it('subscribes, refreshes the same browser once, and unsubscribes', async () => {
      const { token } = await place('Rina');
      expect((await subscribe(token)).status).toBe(200);
      expect((await subscribe(token)).status).toBe(200);
      expect(await subscriptions()).toHaveLength(1);
      expect((await subscribe(token, 2)).status).toBe(200);
      expect(await subscriptions()).toHaveLength(2);

      const removed = await call('DELETE', `/api/orders/${token}/push`, {
        endpoint: endpointOf(1),
      });
      expect(removed.status).toBe(200);
      expect((await subscriptions()).map((row) => row.endpoint)).toEqual([endpointOf(2)]);
      // Idempotent.
      expect(
        (await call('DELETE', `/api/orders/${token}/push`, { endpoint: endpointOf(1) })).status,
      ).toBe(200);
    });

    it('never answers with the endpoint or the keys', async () => {
      const { token } = await place('Rina');
      const reply = await subscribe(token);
      const text = JSON.stringify(reply.body);
      expect(text).not.toContain('secret-endpoint');
      expect(text).not.toContain(KEYS.auth);
      const order = JSON.stringify((await call('GET', `/api/orders/${token}`)).body);
      expect(order).not.toContain('secret-endpoint');
      expect(order).not.toContain(KEYS.p256dh);
    });

    it('refuses a bad endpoint, bad keys and an unknown order', async () => {
      const { token } = await place('Rina');
      const post = (body: unknown) => call('POST', `/api/orders/${token}/push`, body);
      expect((await post({ endpoint: 'http://push.example.test/x', keys: KEYS })).status).toBe(400);
      expect((await post({ endpoint: 'not a url', keys: KEYS })).status).toBe(400);
      const long = `https://push.example.test/${'a'.repeat(1100)}`;
      expect((await post({ endpoint: long, keys: KEYS })).status).toBe(400);
      expect(
        (await post({ endpoint: endpointOf(1), keys: { p256dh: 'x y', auth: KEYS.auth } })).status,
      ).toBe(400);
      expect((await post({ endpoint: endpointOf(1) })).status).toBe(400);
      expect((await subscribe('no-such-token-at-all')).status).toBe(404);
      expect(await subscriptions()).toHaveLength(0);
    });

    it('caps the browsers per order', async () => {
      const { token } = await place('Rina');
      for (let n = 1; n <= 5; n += 1) expect((await subscribe(token, n)).status).toBe(200);
      expect((await subscribe(token, 6)).status).toBe(400);
      // A browser that is already there can still refresh.
      expect((await subscribe(token, 3)).status).toBe(200);
    });

    it('the Origin check applies to subscribe and unsubscribe only for push paths', () => {
      const req = (method: string, path: string, origin?: string) =>
        new Request(`https://delave.test${path}`, {
          method,
          ...(origin ? { headers: { Origin: origin } } : {}),
        });
      expect(checkOrigin(req('POST', '/api/orders/tok/push'))?.status).toBe(403);
      expect(checkOrigin(req('DELETE', '/api/orders/tok/push', 'https://evil.test'))?.status).toBe(
        403,
      );
      expect(checkOrigin(req('POST', '/api/orders/tok/push', 'https://delave.test'))).toBeNull();
      // Other customer routes keep working without it.
      expect(checkOrigin(req('POST', '/api/orders/tok/cancel'))).toBeNull();
    });

    it('serves the public key only when push is set up', async () => {
      const off = await devApi(world.repo, new Request('https://delave.test/api/push/public-key'));
      expect(off?.status).toBe(404);
      const on = await devApi(world.repo, new Request('https://delave.test/api/push/public-key'), {
        vapidPublicKey: 'BPublic',
      });
      expect(await on?.json()).toEqual({ publicKey: 'BPublic' });
    });

    it('counts empty and replace-… placeholder keys as unset', () => {
      expect(realVapidValue('replace-with-the-public-key')).toBeUndefined();
      expect(realVapidValue('')).toBeUndefined();
      expect(realVapidValue(undefined)).toBeUndefined();
      expect(realVapidValue('BReal')).toBe('BReal');
      const placeholders = {
        VAPID_PUBLIC_KEY: 'replace-with-the-public-key',
        VAPID_PRIVATE_KEY: 'replace-with-the-private-key',
        VAPID_SUBJECT: 'mailto:you@example.com',
      };
      expect(vapidFromEnv(placeholders)).toBeUndefined();
      expect(vapidFromEnv({ VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '' })).toBe(
        undefined,
      );
      expect(
        vapidFromEnv({
          VAPID_PUBLIC_KEY: 'a',
          VAPID_PRIVATE_KEY: 'b',
          VAPID_SUBJECT: 'mailto:x@y.z',
        }),
      ).toEqual({ publicKey: 'a', privateKey: 'b', subject: 'mailto:x@y.z' });
    });
  });

  describe('sending', () => {
    it('a message to a place sends one push per subscribed order, in the order language', async () => {
      const a = await place('Ana');
      const b = await place('Budi', { language: 'id' });
      const c = await place('Cici'); // not subscribed
      const d = await place('Dewi', { fulfilment: 'delivery' }); // not at the place
      await subscribe(a.token, 1);
      await subscribe(b.token, 2);
      await subscribe(d.token, 3);
      void c;

      const reply = await seller('/messages/place/glen-waverley', {
        type: 'ready_in',
        minutes: 15,
      });
      expect(reply.status).toBe(200);
      // Nothing went out inside the write: the dispatcher sends when flushed.
      expect(sent).toHaveLength(0);
      await flush();

      expect(sent).toHaveLength(2);
      const byEndpoint = new Map(sent.map((item) => [item.target.endpoint, item.payload]));
      expect(byEndpoint.get(endpointOf(1))).toEqual({
        title: 'Onde Onde',
        body: 'Ready in 15 min',
        icon: '/k/onde-onde/icon-192.png',
        data: { url: `/o/${a.token}` },
      });
      expect(byEndpoint.get(endpointOf(2))?.body).toBe('Siap dalam 15 menit');
      expect(byEndpoint.has(endpointOf(3))).toBe(false);
      expect(sent[0]?.target).toMatchObject({ p256dh: KEYS.p256dh, auth: KEYS.auth });
    });

    it('ready now sends the status move; a custom message sends the seller text', async () => {
      const a = await place('Ana');
      await subscribe(a.token);
      await seller('/messages/place/glen-waverley', { type: 'ready_now' });
      await flush();
      expect(sent.map((item) => item.payload.body)).toEqual(['Ready for pickup']);

      sent = [];
      await seller('/messages/place/glen-waverley', {
        type: 'custom',
        text: { en: 'Running 5 minutes late', id: 'Terlambat 5 menit' },
      });
      await flush();
      expect(sent.map((item) => item.payload.body)).toEqual(['Running 5 minutes late']);
    });

    it('sends status changes and delivery steps, but not payments, locks or the customer own acts', async () => {
      const pickup = await place('Ana');
      const delivery = await place('Budi', { fulfilment: 'delivery' });
      await subscribe(pickup.token, 1);
      await subscribe(delivery.token, 2);

      await seller(`/orders/${pickup.code}/status`, { to: 'confirmed' });
      await seller(`/orders/${pickup.code}/paid`, { paid: true });
      await seller(`/orders/${pickup.code}/lock`, { locked: true });
      await flush();
      expect(sent.map((item) => item.payload.body)).toEqual(['Your order is confirmed']);

      // A nudge is pushed, in the inbox words.
      sent = [];
      await seller(`/orders/${pickup.code}/nudge`, {});
      await flush();
      expect(sent.map((item) => item.payload.body)).toEqual([
        'The seller is waiting for your order number on WhatsApp.',
      ]);

      sent = [];
      await seller(`/orders/${delivery.code}/status`, { to: 'confirmed' });
      await seller(`/orders/${delivery.code}/delivery-step`, { step: 'out_for_delivery' });
      await seller(`/orders/${delivery.code}/delivery-step`, { step: 'arriving_soon', minutes: 5 });
      await flush();
      expect(sent.map((item) => item.payload.body)).toEqual([
        'Your order is confirmed',
        'Out for delivery',
        'Arriving in 5 min',
      ]);

      // The customer's own change and "collected" are not pushed back at them.
      sent = [];
      await call('PATCH', `/api/orders/${delivery.token}`, { note: 'no chilli' });
      await call('POST', `/api/orders/${pickup.token}/collected`);
      await flush();
      expect(sent).toHaveLength(0);
    });

    it('a seller cancel is pushed, then the subscriptions go; a customer cancel just deletes them', async () => {
      const a = await place('Ana');
      const b = await place('Budi');
      await subscribe(a.token, 1);
      await subscribe(b.token, 2);

      await seller(`/orders/${a.code}/status`, { to: 'cancelled', force: true });
      await flush();
      expect(sent.map((item) => item.payload.body)).toEqual(['Order cancelled']);
      expect((await subscriptions()).map((row) => row.endpoint)).toEqual([endpointOf(2)]);

      sent = [];
      expect((await call('POST', `/api/orders/${b.token}/cancel`)).status).toBe(200);
      await flush();
      expect(sent).toHaveLength(0);
      expect(await subscriptions()).toHaveLength(0);
    });

    it('drops a subscription on 404 or 410 and keeps it on other failures', async () => {
      const a = await place('Ana');
      await subscribe(a.token, 1);
      await subscribe(a.token, 2);
      await subscribe(a.token, 3);
      await subscribe(a.token, 4);
      statusFor = (target) => {
        if (target.endpoint === endpointOf(1)) return 410;
        if (target.endpoint === endpointOf(2)) return 404;
        if (target.endpoint === endpointOf(3)) return 500;
        return 'throw';
      };
      const reply = await seller('/messages/place/glen-waverley', { type: 'ready_in', minutes: 5 });
      expect(reply.status).toBe(200);
      await flush();
      expect(sent).toHaveLength(4);
      expect((await subscriptions()).map((row) => row.endpoint)).toEqual([
        endpointOf(3),
        endpointOf(4),
      ]);
      expect(logs).toEqual(['push: 0 sent, 2 expired, 2 failed']);
    });

    it('reads the subscriptions once for many orders', async () => {
      // A dispatcher on the counting database.
      const counted = createPushDispatcher({ db: new Db(world.queries.d1), sender });
      collect = counted.collect;
      for (let i = 0; i < 6; i += 1) {
        const { token } = await place(`Cust${String(i)}`);
        await subscribe(token, i + 1);
      }
      await seller('/messages/place/glen-waverley', { type: 'ready_in', minutes: 10 });
      world.queries.reset();
      await counted.flush();
      expect(sent).toHaveLength(6);
      // One subscriptions read; nothing is deleted.
      expect(world.queries.count()).toBe(1);
    });

    it('does nothing without a sender, and still clears a cancelled order', async () => {
      const quiet = createPushDispatcher({ db: world.db, log: (line) => logs.push(line) });
      collect = quiet.collect;
      const a = await place('Ana');
      await subscribe(a.token);
      await seller(`/orders/${a.code}/status`, { to: 'cancelled', force: true });
      await quiet.flush();
      expect(sent).toHaveLength(0);
      expect(await subscriptions()).toHaveLength(0);
    });

    it('never logs an endpoint, a key or a token', async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
        vi.spyOn(console, method).mockImplementation(() => undefined),
      );
      const noisy = createPushDispatcher({ db: world.db, sender });
      collect = noisy.collect;
      const a = await place('Ana');
      await subscribe(a.token, 1);
      await subscribe(a.token, 2);
      statusFor = (target) => (target.endpoint === endpointOf(1) ? 'throw' : 410);
      await seller('/messages/place/glen-waverley', { type: 'ready_in', minutes: 5 });
      await noisy.flush();
      const written = spies
        .flatMap((spy) => spy.mock.calls.map((args) => args.map(String).join(' ')))
        .join('\n');
      expect(written).toContain('push:');
      for (const secret of ['secret-endpoint', KEYS.auth, KEYS.p256dh, a.token, a.code]) {
        expect(written).not.toContain(secret);
      }
    });
  });

  describe('lifecycle', () => {
    it('finishing the menu clears the subscriptions of its orders', async () => {
      const a = await place('Ana');
      await subscribe(a.token);
      await world.db.stmt("UPDATE menus SET state = 'live'").run();
      const onde = await world.repo.sellerBySlug('onde-onde');
      await onde?.finishMenuNow();
      expect(await subscriptions()).toHaveLength(0);
      // An archived order takes no new subscription.
      expect((await subscribe(a.token)).status).toBe(409);
    });
  });

  describe('paid for customers', () => {
    it('is false until the seller marks the order paid', async () => {
      const a = await place('Ana');
      const read = async () =>
        parseCustomerOrderResponse((await call('GET', `/api/orders/${a.token}`)).body)?.order.paid;
      expect(await read()).toBe(false);
      await seller(`/orders/${a.code}/paid`, { paid: true });
      expect(await read()).toBe(true);
      const list = (await call('GET', `/api/orders?tokens=${a.token}`)).body as {
        orders: Array<{ paid: boolean }>;
      };
      expect(list.orders[0]?.paid).toBe(true);
    });
  });

  describe('kitchen manifest and icons', () => {
    const get = (path: string) =>
      handleKitchenRequest(world.repo, new Request(`https://delave.test${path}`), {});

    it('the manifest has the kitchen name, theme colours, scope and the three icons', async () => {
      const response = await get('/k/onde-onde/manifest.webmanifest?start=/o/token-1');
      expect(response?.status).toBe(200);
      expect(response?.headers.get('Content-Type')).toBe('application/manifest+json');
      const manifest = (await response?.json()) as Record<string, unknown>;
      expect(manifest).toMatchObject({
        name: 'Onde Onde',
        short_name: 'Onde Onde',
        start_url: '/o/token-1',
        scope: '/',
        display: 'standalone',
        background_color: '#F6F2E8',
        theme_color: '#F6F2E8',
      });
      // The sample kitchen has a small icon (a sample picture): PNG-named icons, real type.
      expect(manifest['icons']).toEqual([
        { src: '/k/onde-onde/icon-192.png', sizes: '192x192', type: 'image/jpeg' },
        { src: '/k/onde-onde/icon-512.png', sizes: '512x512', type: 'image/jpeg' },
        {
          src: '/k/onde-onde/icon-512.png',
          sizes: '512x512',
          type: 'image/jpeg',
          purpose: 'maskable',
        },
      ]);
    });

    it('guards start_url: only /o/... or /<slug>, never another origin or kitchen', async () => {
      const start = async (value: string) => {
        const response = await get(
          `/k/onde-onde/manifest.webmanifest?start=${encodeURIComponent(value)}`,
        );
        return ((await response?.json()) as { start_url: string }).start_url;
      };
      expect(await start('/o/abc123')).toBe('/o/abc123');
      expect(await start('/onde-onde')).toBe('/onde-onde');
      expect(await start('/onde-onde/menu')).toBe('/onde-onde/menu');
      for (const bad of [
        'https://evil.test/o/x',
        '//evil.test/o/x',
        '/\\evil.test',
        '/dapur-demo',
        '/seller',
        '/o/../seller',
        'o/abc',
        '',
      ]) {
        expect(await start(bad)).toBe('/onde-onde');
      }
      const none = await get('/k/onde-onde/manifest.webmanifest');
      expect(((await none?.json()) as { start_url: string }).start_url).toBe('/onde-onde');
    });

    it('a kitchen with no uploaded icon gets the initials on its theme colour as SVG', async () => {
      await world.db
        .stmt(
          "DELETE FROM kitchen_images WHERE slot = 'railIcon' AND seller_id = 'seller-dapur-demo'",
        )
        .run();
      await world.db
        .stmt("UPDATE kitchen_settings SET theme = 'sumatra' WHERE seller_id = 'seller-dapur-demo'")
        .run();
      const manifest = (await (await get('/k/dapur-demo/manifest.webmanifest'))?.json()) as {
        icons: Array<{ src: string; type: string }>;
        theme_color: string;
        name: string;
      };
      expect(manifest.name).toBe('Dapur Demo');
      expect(manifest.theme_color).toBe('#F7F0EE');
      expect(manifest.icons.map((icon) => icon.type)).toEqual([
        'image/svg+xml',
        'image/svg+xml',
        'image/svg+xml',
      ]);
      const svg = await get('/k/dapur-demo/icon-512.svg');
      expect(svg?.headers.get('Content-Type')).toBe('image/svg+xml');
      const text = (await svg?.text()) ?? '';
      expect(text).toContain('fill="#8A2232"');
      expect(text).toContain('fill="#FFFFFF"');
      expect(text).toContain('>DD</text>');
      // No PNG can be made without a dependency: the gap is an honest 404.
      expect((await get('/k/dapur-demo/icon-180.png'))?.status).toBe(404);
    });

    // Plan 009 stage 4: the manifest and the icon files follow the kitchen's stored `railIcon` ref.
    // A database seeded before the sample moved to icon-512.jpg still holds the old ref, so its phones
    // get the old art; a seller's own upload replaces it.
    const setIcon = (ref: string) =>
      world.db
        .stmt(
          "UPDATE kitchen_images SET ref = ? WHERE seller_id = 'seller-onde-onde' AND slot = 'railIcon'",
          ref,
        )
        .run();

    it('points at the old sample art while the stored ref is the old sample', async () => {
      await setIcon('/samples/rail-icon.png');
      const manifest = (await (await get('/k/onde-onde/manifest.webmanifest'))?.json()) as {
        icons: Array<{ src: string; type: string }>;
      };
      expect(manifest.icons.map((icon) => icon.type)).toEqual([
        'image/png',
        'image/png',
        'image/png',
      ]);
      expect((await get('/k/onde-onde/icon-180.png'))?.headers.get('Location')).toBe(
        '/samples/rail-icon.png',
      );
    });

    it("serves the seller's own uploaded icon in the manifest and as the 180 px icon", async () => {
      const ref = '/images/sellers/seller-onde-onde/railIcon-0123456789abcdef.png';
      await setIcon(ref);
      const bucket = {
        put: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        get: (key: string) =>
          Promise.resolve(
            key === ref.slice('/images/'.length)
              ? {
                  body: new Response('own-icon-bytes').body as ReadableStream,
                  httpEtag: 'e',
                  httpMetadata: { contentType: 'image/png' },
                }
              : null,
          ),
      };
      const request = (path: string) =>
        handleKitchenRequest(world.repo, new Request(`https://delave.test${path}`), {
          images: bucket,
        });
      const manifest = (await (await request('/k/onde-onde/manifest.webmanifest'))?.json()) as {
        icons: Array<{ type: string }>;
      };
      expect(manifest.icons.every((icon) => icon.type === 'image/png')).toBe(true);
      const icon = await request('/k/onde-onde/icon-180.png');
      expect(icon?.status).toBe(200);
      expect(icon?.headers.get('Content-Type')).toBe('image/png');
      expect(await icon?.text()).toBe('own-icon-bytes');
    });

    it('serves an uploaded icon at any size, and 404s unknown kitchens and sizes', async () => {
      const sample = await get('/k/onde-onde/icon-512.png');
      expect(sample?.status).toBe(302);
      expect(sample?.headers.get('Location')).toBe('/samples/icon-512.jpg');
      expect((await get('/k/nobody/manifest.webmanifest'))?.status).toBe(404);
      expect((await get('/k/onde-onde/icon-300.png'))?.status).toBe(404);
      expect(await get('/k/onde-onde/other.json')).toBeNull();
    });
  });
});
