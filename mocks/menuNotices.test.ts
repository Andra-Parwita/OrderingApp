// @vitest-environment node
// Plan 112 (D-113): new-menu notices. Customers turn them on per kitchen, the owner sees a count and
// sends, the third send for a menu asks first, dead browsers go, and the weekly retention sweeps.
// Runs against a local D1; the push sender is a stand-in.
import { beforeEach, describe, expect, it } from 'vitest';
import { MENU_NOTICE_PER_KITCHEN_MAX, parseMenuNoticeStatus } from '../shared/menuNoticeContract';
import type { PushPayload } from '../shared/pushContract';
import { MENU_NOTICE_ROUTES } from '../worker/api/menuNoticeRoutes';
import { runRetention } from '../worker/api/scheduled';
import { createMenuNoticeService } from '../worker/push/menuNotice';
import type { PushSender, PushTarget } from '../worker/push/sender';
import { devApi, useWorld, type World } from './impl';

const START = new Date('2026-10-07T10:00:00Z');
const KEYS = { p256dh: 'BPublicKeyOfTheBrowser_abc-123', auth: 'AuthSecret_xyz-789' };
const endpointOf = (n: number) => `https://push.example.test/send/notice-endpoint-${String(n)}`;
const SELLER = 'seller-onde-onde';

describe('new-menu notices', () => {
  const create = useWorld('menuNotices');
  let world: World;
  let now: Date;
  let sent: Array<{ target: PushTarget; payload: PushPayload }>;
  let statusFor: (target: PushTarget) => number;
  let context: Parameters<typeof devApi>[2];

  const sender: PushSender = (target, payload) => {
    sent.push({ target, payload });
    return Promise.resolve(statusFor(target));
  };

  async function call(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { Origin: 'https://delave.test' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
      context,
    );
    return { status: response?.status ?? -1, body: (await response?.json()) as unknown };
  }

  const subscribe = (n: number, language: 'en' | 'id' = 'en') =>
    call('POST', '/api/s/onde-onde/menu-notices', {
      subscription: { endpoint: endpointOf(n), keys: KEYS },
      language,
    });
  const status = () => call('GET', '/api/seller/menu-notices');
  const send = (again?: boolean) =>
    call('POST', '/api/seller/menu-notices/send', again === undefined ? undefined : { again });
  const rows = () =>
    world.db.all<{ endpoint: string; language: string; last_order_at: string }>(
      'SELECT endpoint, language, last_order_at FROM menu_notice_subscriptions ORDER BY endpoint',
    );
  const sendRows = () =>
    world.db.all<{ menu_id: string; reached: number }>(
      'SELECT menu_id, reached FROM menu_notice_sends ORDER BY sent_at',
    );
  const later = (minutes: number) => {
    now = new Date(now.getTime() + minutes * 60_000);
  };

  beforeEach(async () => {
    now = START;
    sent = [];
    statusFor = () => 201;
    world = await create({ now: () => now });
    await world.db.stmt("UPDATE menus SET state = 'live' WHERE seller_id = ?", SELLER).run();
    context = {
      menuNotices: createMenuNoticeService({
        db: world.db,
        now: () => now,
        sender,
        log: () => undefined,
      }),
    };
  });

  describe('customers', () => {
    it('subscribes, refreshes the same browser once, and unsubscribes', async () => {
      expect((await subscribe(1)).status).toBe(200);
      later(60);
      expect((await subscribe(1, 'id')).status).toBe(200);
      const [row] = await rows();
      expect(await rows()).toHaveLength(1);
      expect(row?.language).toBe('id');
      expect(row?.last_order_at).toBe(now.toISOString());
      expect((await subscribe(2)).status).toBe(200);
      expect(await rows()).toHaveLength(2);

      const removed = await call('DELETE', '/api/s/onde-onde/menu-notices', {
        endpoint: endpointOf(1),
      });
      expect(removed.status).toBe(200);
      expect((await rows()).map((r) => r.endpoint)).toEqual([endpointOf(2)]);
    });

    it('keeps no name, phone or order: only the kitchen, the browser and a language', async () => {
      await subscribe(1);
      const columns = await world.db.all<{ name: string }>(
        "SELECT name FROM pragma_table_info('menu_notice_subscriptions')",
      );
      expect(columns.map((c) => c.name).sort()).toEqual([
        'auth',
        'created_at',
        'endpoint',
        'language',
        'last_order_at',
        'p256dh',
        'seller_id',
      ]);
    });

    it('refuses a bad body, an http endpoint and an unknown kitchen', async () => {
      expect((await call('POST', '/api/s/onde-onde/menu-notices', {})).status).toBe(400);
      const http = await call('POST', '/api/s/onde-onde/menu-notices', {
        subscription: { endpoint: 'http://push.example.test/x', keys: KEYS },
        language: 'en',
      });
      expect(http.status).toBe(400);
      const language = await call('POST', '/api/s/onde-onde/menu-notices', {
        subscription: { endpoint: endpointOf(1), keys: KEYS },
        language: 'fr',
      });
      expect(language.status).toBe(400);
      const nobody = await call('POST', '/api/s/nobody/menu-notices', {
        subscription: { endpoint: endpointOf(1), keys: KEYS },
        language: 'en',
      });
      expect(nobody.status).toBe(404);
      expect(await rows()).toHaveLength(0);
    });

    it('caps the phones per kitchen, but still refreshes a known one', async () => {
      await world.db
        .stmt(
          `WITH RECURSIVE c(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM c WHERE n < ?)
           INSERT INTO menu_notice_subscriptions
             (seller_id, endpoint, p256dh, auth, language, created_at, last_order_at)
           SELECT ?, 'https://push.example.test/bulk/' || n, 'p', 'a', 'en', ?, ? FROM c`,
          MENU_NOTICE_PER_KITCHEN_MAX,
          SELLER,
          now.toISOString(),
          now.toISOString(),
        )
        .run();
      expect((await subscribe(1)).status).toBe(400);
      await world.db
        .stmt(
          'UPDATE menu_notice_subscriptions SET endpoint = ? WHERE endpoint = ?',
          endpointOf(7),
          'https://push.example.test/bulk/1',
        )
        .run();
      expect((await subscribe(7)).status).toBe(200);
    });
  });

  describe('the owner', () => {
    it('sees the count and the sends of the current menu, and whether it can send', async () => {
      await subscribe(1);
      await subscribe(2);
      const first = await status();
      const parsed = parseMenuNoticeStatus(first.body);
      expect(first.status).toBe(200);
      expect(parsed).toMatchObject({ phones: 2, sends: [], canSend: true });
      expect(JSON.stringify(first.body)).not.toContain('push.example.test');
    });

    it('cannot send once orders closed, when the menu is not live, or when ordering is off', async () => {
      await subscribe(1);
      await world.db.stmt('UPDATE menus SET taking_orders = 0 WHERE seller_id = ?', SELLER).run();
      expect(parseMenuNoticeStatus((await status()).body)?.canSend).toBe(false);
      await world.db.stmt('UPDATE menus SET taking_orders = 1 WHERE seller_id = ?', SELLER).run();
      await world.db
        .stmt("UPDATE menus SET state = 'not_published' WHERE seller_id = ?", SELLER)
        .run();
      expect(parseMenuNoticeStatus((await status()).body)?.canSend).toBe(false);
      await world.db.stmt("UPDATE menus SET state = 'live' WHERE seller_id = ?", SELLER).run();
      now = new Date('2026-10-20T10:00:00Z');
      expect(parseMenuNoticeStatus((await status()).body)?.canSend).toBe(false);

      const refused = await send();
      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({ error: 'not_open' });
      expect(sent).toHaveLength(0);
      expect(await sendRows()).toHaveLength(0);
    });

    it('sends to every phone in its own language, with the day, and records how many it reached', async () => {
      await subscribe(1);
      await subscribe(2, 'id');
      await subscribe(3);
      const reply = await send();
      expect(reply.status).toBe(200);
      expect(sent).toHaveLength(3);
      const bodies = sent.map((item) => item.payload.body).sort();
      expect(bodies).toEqual([
        'Menu baru sudah ada: pesan untuk Sabtu, 10 Okt.',
        'New menu is out: order for Sat 10 Oct.',
        'New menu is out: order for Sat 10 Oct.',
      ]);
      expect(sent[0]?.payload.title).toBe('Onde Onde');
      expect(sent[0]?.payload.data.url).toBe('/onde-onde');
      expect(parseMenuNoticeStatus(reply.body)).toMatchObject({
        phones: 3,
        sends: [{ sentAt: now.toISOString(), reached: 3 }],
        canSend: true,
      });
      const menu = await world.db.first<{ id: string }>(
        'SELECT id FROM menus WHERE seller_id = ?',
        SELLER,
      );
      expect(await sendRows()).toEqual([{ menu_id: menu?.id, reached: 3 }]);
    });

    it('drops browsers that answer 404 or 410, and counts only the ones reached', async () => {
      await subscribe(1);
      await subscribe(2);
      await subscribe(3);
      await subscribe(4);
      statusFor = (target) =>
        target.endpoint === endpointOf(2)
          ? 410
          : target.endpoint === endpointOf(3)
            ? 404
            : target.endpoint === endpointOf(4)
              ? 500
              : 201;
      const reply = await send();
      expect(parseMenuNoticeStatus(reply.body)?.sends[0]?.reached).toBe(1);
      expect((await rows()).map((r) => r.endpoint)).toEqual([endpointOf(1), endpointOf(4)]);
    });

    it('asks before a third send for the same menu, and keeps the sends with the menu', async () => {
      await subscribe(1);
      expect((await send()).status).toBe(200);
      later(5);
      expect((await send()).status).toBe(200);
      later(5);
      const asked = await send();
      expect(asked.status).toBe(409);
      expect(asked.body).toMatchObject({ error: 'sent_twice' });
      expect((asked.body as { sends: Array<unknown> }).sends).toHaveLength(2);
      expect(await sendRows()).toHaveLength(2);
      expect(sent).toHaveLength(2);

      const again = await send(true);
      expect(again.status).toBe(200);
      expect(parseMenuNoticeStatus(again.body)?.sends).toHaveLength(3);
      expect(sent).toHaveLength(3);
    });

    it('sends to nobody while the admin has the kitchen fully paused', async () => {
      await subscribe(1);
      await world.db.stmt("UPDATE sellers SET paused = 'full' WHERE id = ?", SELLER).run();
      const reply = await send();
      expect(reply.status).toBe(200);
      expect(sent).toHaveLength(0);
      expect(parseMenuNoticeStatus(reply.body)?.sends[0]?.reached).toBe(0);
    });

    it('is the owner alone: both routes list only the owner role', () => {
      expect(MENU_NOTICE_ROUTES.map((entry) => `${entry.method} ${entry.path}`)).toEqual([
        'GET menu-notices',
        'POST menu-notices/send',
      ]);
      for (const entry of MENU_NOTICE_ROUTES) expect(entry.roles).toEqual(['owner']);
    });

    it('answers 404 when notices are not set up on the server', async () => {
      context = {};
      expect((await status()).status).toBe(404);
      expect((await subscribe(1)).status).toBe(404);
    });
  });

  describe('retention', () => {
    it('drops phones idle for 183 days and the sends of menus that are gone', async () => {
      const old = new Date(START.getTime() - 184 * 86_400_000).toISOString();
      const recent = new Date(START.getTime() - 100 * 86_400_000).toISOString();
      await world.db.batch([
        world.db.stmt(
          `INSERT INTO menu_notice_subscriptions
             (seller_id, endpoint, p256dh, auth, language, created_at, last_order_at)
           VALUES (?, ?, 'p', 'a', 'en', ?, ?)`,
          SELLER,
          endpointOf(1),
          old,
          old,
        ),
        world.db.stmt(
          `INSERT INTO menu_notice_subscriptions
             (seller_id, endpoint, p256dh, auth, language, created_at, last_order_at)
           VALUES (?, ?, 'p', 'a', 'en', ?, ?)`,
          SELLER,
          endpointOf(2),
          old,
          recent,
        ),
        world.db.stmt(
          "INSERT INTO menu_notice_sends (seller_id, menu_id, sent_at, reached) VALUES (?, 'an-old-menu', ?, 4)",
          SELLER,
          old,
        ),
      ]);
      await subscribe(3);
      await send();
      expect(await sendRows()).toHaveLength(2);

      const lines: Array<string> = [];
      await runRetention({ DB: world.db.d1 }, START, (line) => lines.push(line));

      expect((await rows()).map((r) => r.endpoint)).toEqual([endpointOf(2), endpointOf(3)]);
      const left = await sendRows();
      expect(left).toHaveLength(1);
      expect(left[0]?.menu_id).not.toBe('an-old-menu');
      expect(lines.some((line) => line.includes('1 notice phone(s), 1 notice send(s)'))).toBe(true);
    });
  });
});
