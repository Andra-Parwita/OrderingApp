/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 121 part B: anonymous order statistics. The phone sends four facts with an order; the Worker
// keeps the valid ones and drops the rest (a bad `stats` never fails an order), stores them, never
// shows them to a seller or customer, and counts them for the admin only (per kitchen and week,
// sample and team-entered orders left out, an order that said nothing counted as unknown). A backup
// carries them. Runs against a local D1; see mocks/impl.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBackupFile } from '../shared/backup';
import { parseStatsResponse, type StatsResponse } from '../shared/orderStats';
import { DEV_ADMIN_SETUP_KEY, devApi, useWorld, type World } from './impl';
import { SoftAuthenticator } from './softAuthenticator';

const SITE = 'https://delave.test';

type Row = {
  src_place: string | null;
  src_os: string | null;
  src_push: number | null;
  src_remember: number | null;
};
const NONE: Row = { src_place: null, src_os: null, src_push: null, src_remember: null };

describe('anonymous order statistics (plan 121 B)', () => {
  const create = useWorld('order-stats');
  const authenticator = new SoftAuthenticator(SITE);
  let clock = new Date('2026-10-07T10:00:00Z');
  let world: World;
  let n = 0;

  async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
    const headers: Record<string, string> = {};
    if (opts.token) headers['Cookie'] = `__Host-session=${opts.token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`${SITE}${path}`, {
        method,
        headers,
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      }),
    );
    const text = (await response?.text()) ?? '';
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON
    }
    const cookie = response?.headers.get('set-cookie') ?? '';
    return {
      status: response?.status ?? -1,
      text,
      body,
      token: /__Host-session=([^;]+)/.exec(cookie)?.[1] ?? '',
    };
  }
  /** A seller call in the dev seller (the X-Seller header, as the other D1 tests do). */
  const seller = (method: string, path: string, body?: unknown) =>
    devApi(
      world.repo,
      new Request(`${SITE}${path}`, {
        method,
        headers: { 'X-Seller': 'onde-onde', 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );

  async function adminToken(): Promise<string> {
    const setup = await call('POST', '/api/admin/setup', {
      body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: 'device-aaaa-0001' },
    });
    const asked = await call('POST', '/api/auth/register/options', { token: setup.token });
    const done = await call('POST', '/api/auth/register', {
      token: setup.token,
      body: {
        kind: 'passkey',
        deviceName: 'Laptop',
        response: authenticator.create(asked.body.options as never),
      },
    });
    expect(done.status).toBe(201);
    return done.token;
  }

  const place = (firstName: string, stats?: unknown) =>
    call('POST', '/api/s/onde-onde/orders', {
      body: {
        firstName,
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
        ...(stats !== undefined ? { stats } : {}),
      },
    });
  const rowOf = (code: string) =>
    world.db.first<Row>(
      'SELECT src_place, src_os, src_push, src_remember FROM orders WHERE code = ?',
      code,
    );
  const placed = async (firstName: string, stats?: unknown) => {
    const reply = await place(firstName, stats);
    expect(reply.status, reply.text).toBe(201);
    return (reply.body as { order: { code: string } }).order.code;
  };

  beforeAll(async () => {
    world = await create({
      now: () => clock,
      newToken: () => `token-${String(++n)}-padding-padding`,
    });
    await world.db.stmt('UPDATE menu_items SET portion_limit = NULL').run();
  }, 60_000);

  it('stores the four facts of a good order', async () => {
    const code = await placed('Rina', { place: 'app', os: 'ios', push: true, remember: false });
    expect(await rowOf(code)).toEqual({
      src_place: 'app',
      src_os: 'ios',
      src_push: 1,
      src_remember: 0,
    });
  });

  it('drops every bad value and still places the order', async () => {
    const bad = [
      {
        place: 'evil <script>',
        os: 'windows',
        push: 'yes',
        remember: 1,
        name: 'Rina 0412 345 678',
      },
      { place: 7, os: ['ios'], push: null, remember: {} },
      'garbage',
      [],
      42,
      null,
      {},
    ];
    for (const stats of bad) {
      const code = await placed('Tom', stats);
      expect(await rowOf(code), JSON.stringify(stats)).toEqual(NONE);
    }
    // One good, one bad: the good one is kept.
    const code = await placed('Ana', { place: 'browser', os: 'symbian' });
    expect(await rowOf(code)).toMatchObject({ src_place: 'browser', src_os: null });
  });

  it('an old client sends nothing: all four stay null', async () => {
    expect(await rowOf(await placed('Old phone'))).toEqual(NONE);
  });

  it('adds no round trip and no statement to placing an order', async () => {
    const measure = async (stats?: unknown) => {
      world.queries.reset();
      await placed('Count', stats);
      return { trips: world.queries.count(), statements: world.queries.statements() };
    };
    const without = await measure();
    const withStats = await measure({ place: 'inapp', os: 'android', push: false, remember: true });
    expect(withStats).toEqual(without);
  });

  it('never shows the facts to the seller, the customer or the order reply', async () => {
    const reply = await place('Quiet', { place: 'app', os: 'ios', push: true, remember: true });
    expect(reply.text).not.toMatch(/stats|src_|"place"|"os"/);
    const { code, token } = (reply.body as { order: { code: string; token: string } }).order;
    const list = await seller('GET', '/api/seller/orders');
    expect(await list?.text()).not.toMatch(/stats|src_/);
    const one = await seller('GET', `/api/seller/orders/${code}`);
    expect(await one?.text()).not.toMatch(/stats|src_/);
    expect((await call('GET', `/api/orders/${token}`)).text).not.toMatch(/stats|src_/);
  });

  describe('the admin counts', () => {
    let admin = '';
    const stats = async (): Promise<StatsResponse> => {
      const reply = await call('GET', '/api/admin/stats', { token: admin });
      expect(reply.status).toBe(200);
      const parsed = parseStatsResponse(reply.body);
      expect(parsed).not.toBeNull();
      return parsed!;
    };

    beforeAll(async () => {
      admin = await adminToken();
      // A clean slate: only the orders below count.
      for (const table of ['order_lines', 'order_audit', 'order_inbox', 'orders']) {
        await world.db.stmt(`DELETE FROM ${table}`).run();
      }
      // The menu only takes orders before its cut-off, so each order is placed now and then dated.
      const placedAt = async (when: string, name: string, stats?: unknown) => {
        const code = await placed(name, stats);
        await world.db
          .stmt('UPDATE orders SET created_at = ? WHERE code = ?', `${when}:00.000Z`, code)
          .run();
        return code;
      };
      // Week of Mon 5 Oct 2026 (Wed 7 Oct): three said something, one said nothing.
      await placedAt('2026-10-07T10:00', 'A', {
        place: 'app',
        os: 'ios',
        push: true,
        remember: true,
      });
      await placedAt('2026-10-07T10:00', 'B', {
        place: 'browser',
        os: 'android',
        push: false,
        remember: false,
      });
      await placedAt('2026-10-07T10:00', 'C', { place: 'inapp', os: 'other', push: true });
      await placedAt('2026-10-07T10:00', 'D');
      // The Sunday of that week still belongs to it; the next Monday starts a new one.
      await placedAt('2026-10-11T23:30', 'E', {
        place: 'app',
        os: 'ios',
        push: false,
        remember: false,
      });
      await placedAt('2026-10-12T00:10', 'F', {
        place: 'app',
        os: 'ios',
        push: true,
        remember: true,
      });
      // Older than eight weeks: not counted.
      await placedAt('2026-08-05T10:00', 'Old', {
        place: 'app',
        os: 'ios',
        push: true,
        remember: true,
      });
      // A sample order and a team-entered order are left out.
      const sample = await placedAt('2026-10-07T11:00', 'Sample', {
        place: 'app',
        os: 'ios',
        push: true,
        remember: true,
      });
      await world.db.stmt('UPDATE orders SET sample = 1 WHERE code = ?', sample).run();
      const entered = await seller('POST', '/api/seller/orders', {
        firstName: 'Walk-in',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
      });
      expect(entered?.status).toBe(201);
    }, 60_000);

    it('counts per kitchen and week, newest first; unknown for what was not said', async () => {
      clock = new Date('2026-10-14T10:00:00Z'); // the table looks back eight weeks from here
      const { kitchens } = await stats();
      clock = new Date('2026-10-07T10:00:00Z');
      const onde = kitchens.find((k) => k.slug === 'onde-onde');
      expect(onde?.weeks.map((w) => w.week)).toEqual(['2026-10-12', '2026-10-05']);
      expect(onde?.weeks[1]).toEqual({
        week: '2026-10-05',
        orders: 5, // A, B, C, D, E (E at 23:30 on Sunday)
        place: { app: 2, browser: 1, inapp: 1, unknown: 1 },
        os: { ios: 2, android: 1, other: 1, unknown: 1 },
        push: { on: 2, off: 2, unknown: 1 },
        remember: { on: 1, off: 2, unknown: 2 },
      });
      expect(onde?.weeks[0]).toEqual({
        week: '2026-10-12',
        orders: 1,
        place: { app: 1, browser: 0, inapp: 0, unknown: 0 },
        os: { ios: 1, android: 0, other: 0, unknown: 0 },
        push: { on: 1, off: 0, unknown: 0 },
        remember: { on: 1, off: 0, unknown: 0 },
      });
    });

    it('lists a kitchen with no orders with no weeks, and carries nothing per order', async () => {
      const { kitchens } = await stats();
      expect(kitchens.length).toBeGreaterThanOrEqual(2);
      expect(kitchens.find((k) => k.slug !== 'onde-onde')?.weeks).toEqual([]);
      const reply = await call('GET', '/api/admin/stats', { token: admin });
      expect(reply.text).not.toMatch(/token|"code"|firstName|"A"/);
    });

    it('is for the admin only', async () => {
      expect((await call('GET', '/api/admin/stats')).status).toBe(401);
      expect((await call('GET', '/api/admin/stats', { token: 'nope' })).status).toBe(401);
    });
  });

  describe('backup and restore', () => {
    it('carry the four facts; a file without them restores with null', async () => {
      await world.db.stmt('DELETE FROM orders').run();
      const code = await placed('Backup', {
        place: 'inapp',
        os: 'android',
        push: false,
        remember: true,
      });
      const store = await world.repo.sellerBySlug('onde-onde');
      const file = await store!.exportBackup();
      expect(file.orders.find((o) => o.code === code)?.stats).toEqual({
        place: 'inapp',
        os: 'android',
        push: false,
        remember: true,
      });
      const text = JSON.stringify(file);

      // Restore it: the row has the facts again.
      await world.db.stmt('DELETE FROM orders').run();
      const parsed = parseBackupFile(JSON.parse(text));
      expect(parsed).not.toBeNull();
      await store!.restoreBackup(parsed!);
      expect(await rowOf(code)).toEqual({
        src_place: 'inapp',
        src_os: 'android',
        src_push: 0,
        src_remember: 1,
      });

      // An older file has no `stats`: it restores, with all four null.
      const older = JSON.parse(text);
      for (const order of older.orders) delete order.stats;
      await world.db.stmt('DELETE FROM orders').run();
      await store!.restoreBackup(parseBackupFile(older)!);
      expect(await rowOf(code)).toEqual(NONE);

      // A damaged `stats` in a file is dropped, not a reason to refuse the file.
      const damaged = JSON.parse(text);
      for (const order of damaged.orders) order.stats = { place: 'x', os: 5, push: 'no' };
      const reparsed = parseBackupFile(damaged);
      expect(reparsed).not.toBeNull();
      expect(reparsed?.orders.every((o) => o.stats === undefined)).toBe(true);
    });
  });
});
