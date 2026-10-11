// @vitest-environment node
// Plan 029, stages 1-2 (server): how a dish is sold, and the atomic day stock with its sales log.
// Roles: owners and helpers sell; a chef and a customer cannot. Customers never see the count.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseApiError } from '../shared/apiError';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import { parseDayLogResponse, parseDayStockResponse } from '../shared/daySalesContract';
import { parseMenuResponse } from '../shared/menuContract';
import { Db } from '../worker/db/d1';
import { dropOldDaySales } from '../worker/db/daySales';
import { devApi, openDatabase, useWorld, type Database, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const SLUG = 'onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');

describe('selling on the day (plan 029, server)', () => {
  const create = useWorld('day-selling');
  let world: World;
  let tokens = 0;

  type Reply = { status: number; body: unknown; setCookie: string | null };
  async function call(
    method: string,
    path: string,
    options: { token?: string; body?: unknown } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (options.token) headers['Cookie'] = `__Host-session=${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
    );
    if (!response) return { status: -1, body: null, setCookie: null };
    const text = await response.text();
    const setCookie = response.headers.get('set-cookie');
    try {
      return { status: response.status, body: JSON.parse(text) as unknown, setCookie };
    } catch {
      return { status: response.status, body: text, setCookie };
    }
  }

  function session(reply: Reply) {
    const parsed = parseSessionResponse(reply.body);
    const token = /__Host-session=([^;]+)/.exec(reply.setCookie ?? '')?.[1];
    if (!parsed || !token) throw new Error(`not a session: ${JSON.stringify(reply)}`);
    return { ...parsed, token };
  }
  const keyOf = (reply: Reply) => {
    const parsed = parseKeyResponse(reply.body);
    if (!parsed) throw new Error(`not a key: ${JSON.stringify(reply)}`);
    return parsed;
  };
  async function newPerson(inviteKey: string, deviceId: string, password: string) {
    const setup = session(
      await call('POST', '/api/auth/invite', { body: { key: inviteKey, deviceId } }),
    );
    return session(
      await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password, deviceName: 'Phone' },
      }),
    );
  }

  beforeEach(async () => {
    tokens = 0;
    world = await create({
      now: () => new Date(START),
      newToken: () => `token-${String(++tokens)}`,
    });
  });

  /** The owner, a helper and a chef (Wati), each signed in. */
  async function people() {
    const ownerKey = await world.repo.auth.createKey({
      role: 'owner',
      sellerId: SELLER_ID,
      displayName: 'Olive',
    });
    const owner = await newPerson(ownerKey.key, 'owner-0001-aaaa', 'correct horse battery');
    const helperInvite = await call('POST', '/api/seller/invites', {
      token: owner.token,
      body: { displayName: 'Dewi', role: 'helper' },
    });
    const helper = await newPerson(
      keyOf(helperInvite).key,
      'helper-0001-bb',
      'helper long password',
    );
    const chefInvite = await call('POST', '/api/seller/chef-invites', {
      token: owner.token,
      body: { chefId: 'wati' },
    });
    const chef = await newPerson(keyOf(chefInvite).key, 'wati-0001-bbbb', 'chef long password');
    return { owner, helper, chef };
  }

  type Person = { token: string };
  const patchItem = (who: Person, id: string, body: unknown) =>
    call('PATCH', `/api/seller/menu/items/${id}`, { token: who.token, body });
  const sell = (who: Person, itemId: string, qty = 1) =>
    call('POST', '/api/seller/day/sale', { token: who.token, body: { itemId, qty } });
  const setCount = (who: Person, itemId: string, count: number) =>
    call('POST', '/api/seller/day/count', { token: who.token, body: { itemId, count } });
  const log = async (who: Person) => {
    const parsed = parseDayLogResponse(
      (await call('GET', '/api/seller/day/log', { token: who.token })).body,
    );
    if (!parsed) throw new Error('not a log');
    return parsed.entries;
  };
  const order = (itemId: string, qty = 1) =>
    call('POST', `/api/s/${SLUG}/orders`, {
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId, qty }],
      },
    });
  const customerItems = async () => {
    const reply = await call('GET', `/api/s/${SLUG}/menu`);
    const menu = parseMenuResponse(reply.body);
    if (!menu) throw new Error('not a menu');
    return { menu, raw: JSON.stringify(reply.body) };
  };
  const errorOf = (reply: Reply) => parseApiError(reply.body)?.error;
  const stockOf = (reply: Reply) => parseDayStockResponse(reply.body)?.dayStock;

  describe('stage 1: how a dish is sold', () => {
    it('a menu item reads preorder on and no day stock until the owner sets them', async () => {
      const { owner } = await people();
      const items = (
        (await call('GET', '/api/seller/menu', { token: owner.token })).body as {
          items: Array<{ id: string; preorder?: boolean; dayStock?: number }>;
        }
      ).items;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.preorder).toBeUndefined(); // absent = on (the default)
        expect(item.dayStock).toBeUndefined(); // absent = not sold on the day
      }
    });

    it('refuses an on-the-day-only dish in an order, and needs a stock to switch pre-order off', async () => {
      const { owner } = await people();
      expect((await patchItem(owner, 'pesmol', { preorder: false })).status).toBe(400);
      expect((await patchItem(owner, 'pesmol', { preorder: false, dayStock: 4 })).status).toBe(200);
      const refused = await order('pesmol');
      expect(refused.status).toBe(409);
      expect(errorOf(refused)).toBe('not_preorderable');
      // Another dish still orders.
      expect((await order('lemper')).status).toBe(201);
      // Back to pre-order: ordering works again.
      expect((await patchItem(owner, 'pesmol', { preorder: true })).status).toBe(200);
      expect((await order('pesmol')).status).toBe(201);
    });

    it('a dish sold both ways takes pre-orders up to its limit while the day stock stays', async () => {
      const { owner } = await people();
      await patchItem(owner, 'pesmol', { limit: 2, dayStock: 5 });
      expect((await order('pesmol', 2)).status).toBe(201);
      const over = await order('pesmol', 1);
      expect(over.status).toBe(409);
      expect(errorOf(over)).toBe('sold_out');
      const menu = (await call('GET', '/api/seller/menu', { token: owner.token })).body as {
        items: Array<{ id: string; dayStock?: number }>;
      };
      expect(menu.items.find((item) => item.id === 'pesmol')?.dayStock).toBe(5);
      // Day sales don't change the pre-order count either.
      expect(stockOf(await sell(owner, 'pesmol', 2))).toBe(3);
      const after = (await customerItems()).menu.items.find((item) => item.id === 'pesmol');
      expect(after?.remaining).toBe(0);
    });

    it('a saved dish keeps both fields onto a menu (copy from the library)', async () => {
      const { owner } = await people();
      const made = await call('POST', '/api/seller/dishes', {
        token: owner.token,
        body: {
          name: { en: 'Stall satay', id: 'Sate' },
          priceCents: 3000,
          preorder: false,
          dayStock: 12,
        },
      });
      expect(made.status).toBe(201);
      const dish = (made.body as { dish: { id: string; preorder?: boolean; dayStock?: number } })
        .dish;
      expect(dish).toMatchObject({ preorder: false, dayStock: 12 });
      const listed = (await call('GET', '/api/seller/dishes', { token: owner.token })).body as {
        dishes: Array<{ id: string; preorder?: boolean; dayStock?: number }>;
      };
      expect(listed.dishes.find((d) => d.id === dish.id)).toMatchObject({
        preorder: false,
        dayStock: 12,
      });
      // Edit: clearing the stock while pre-order is off is refused; turning pre-order on first is fine.
      const bad = await call('PATCH', `/api/seller/dishes/${dish.id}`, {
        token: owner.token,
        body: { dayStock: null },
      });
      expect(bad.status).toBe(400);
      const edited = await call('PATCH', `/api/seller/dishes/${dish.id}`, {
        token: owner.token,
        body: { preorder: true, dayStock: null },
      });
      expect(edited.status).toBe(200);
      await call('PATCH', `/api/seller/dishes/${dish.id}`, {
        token: owner.token,
        body: { preorder: false, dayStock: 7 },
      });
      // Put it on the menu: the item is a copy that keeps both.
      const view = await call('PUT', '/api/seller/menus/current', {
        token: owner.token,
        body: { dishIds: [dish.id] },
      });
      expect(view.status).toBe(200);
      const items = (
        (await call('GET', '/api/seller/menu', { token: owner.token })).body as {
          items: Array<{ name: { en: string }; preorder?: boolean; dayStock?: number }>;
        }
      ).items;
      expect(items.find((item) => item.name.en === 'Stall satay')).toMatchObject({
        preorder: false,
        dayStock: 7,
      });
    });

    it('the customer menu never carries the count: only available on the day, or sold out', async () => {
      const { owner } = await people();
      await patchItem(owner, 'pesmol', { preorder: false, dayStock: 2 });
      await patchItem(owner, 'lemper', { dayStock: 3 }); // both ways
      let { menu, raw } = await customerItems();
      expect(raw).not.toContain('dayStock');
      expect(menu.items.find((item) => item.id === 'pesmol')).toMatchObject({
        preorder: false,
        onTheDay: 'available',
      });
      expect(menu.items.find((item) => item.id === 'lemper')?.onTheDay).toBe('available');
      expect(menu.items.find((item) => item.id === 'nasi-campur')?.onTheDay).toBeUndefined();
      await sell(owner, 'pesmol', 2);
      ({ menu, raw } = await customerItems());
      expect(raw).not.toContain('dayStock');
      expect(menu.items.find((item) => item.id === 'pesmol')?.onTheDay).toBe('sold_out');
      // The pre-order side of lemper is untouched by the stall running out.
      await setCount(owner, 'lemper', 0);
      expect((await customerItems()).menu.items.find((item) => item.id === 'lemper')).toMatchObject(
        { onTheDay: 'sold_out', soldOut: false },
      );
      expect((await order('lemper')).status).toBe(201);
    });
  });

  describe('stage 2: atomic stock and the sales log', () => {
    it('two sales of the last portion at once: one succeeds, one is sold out', async () => {
      const { owner, helper } = await people();
      await patchItem(owner, 'pesmol', { dayStock: 1 });
      const [a, b] = await Promise.all([sell(owner, 'pesmol'), sell(helper, 'pesmol')]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const failed = a.status === 409 ? a : b;
      expect(errorOf(failed)).toBe('sold_out');
      const done = a.status === 200 ? a : b;
      expect(stockOf(done)).toBe(0);
      const entries = await log(owner);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        kind: 'sale',
        change: -1,
        stockAfter: 0,
        itemId: 'pesmol',
      });
    });

    it('many sales at once never take more than the stock', async () => {
      const { owner, helper } = await people();
      await patchItem(owner, 'pesmol', { dayStock: 3 });
      const replies = await Promise.all(
        [owner, helper, owner, helper, owner].map((who) => sell(who, 'pesmol')),
      );
      expect(replies.filter((r) => r.status === 200)).toHaveLength(3);
      expect(replies.filter((r) => errorOf(r) === 'sold_out')).toHaveLength(2);
      expect((await log(owner)).map((e) => e.stockAfter).sort()).toEqual([0, 1, 2]);
    });

    it('sells -n, refuses more than is left, and records who sold', async () => {
      const { owner, helper } = await people();
      await setCount(owner, 'pesmol', 10);
      expect(stockOf(await sell(helper, 'pesmol', 4))).toBe(6);
      const tooMany = await sell(owner, 'pesmol', 7);
      expect(tooMany.status).toBe(409);
      expect(errorOf(tooMany)).toBe('sold_out');
      expect(stockOf(await sell(owner, 'pesmol', 6))).toBe(0);
      const entries = await log(owner);
      expect(entries.filter((e) => e.kind === 'sale').map((e) => [e.by, e.change])).toEqual([
        ['Olive', -6],
        ['Dewi', -4],
      ]);
      expect((await sell(owner, 'pesmol')).status).toBe(409); // 0 = sold out at the stall
    });

    it('set count writes the stock and logs the difference', async () => {
      const { owner, helper } = await people();
      // From "not sold on the day" to 10: the difference is +10.
      expect(stockOf(await setCount(owner, 'pesmol', 10))).toBe(10);
      await sell(owner, 'pesmol', 3);
      expect(stockOf(await setCount(helper, 'pesmol', 4))).toBe(4); // 7 -> 4: -3
      expect(stockOf(await setCount(owner, 'pesmol', 4))).toBe(4); // no change: no row
      const entries = await log(owner);
      expect(entries.map((e) => [e.kind, e.change, e.stockAfter, e.by])).toEqual([
        ['count', -3, 4, 'Dewi'],
        ['sale', -3, 7, 'Olive'],
        ['count', 10, 10, 'Olive'],
      ]);
      // The log adds up to the stock.
      expect(entries.reduce((sum, e) => sum + e.change, 0)).toBe(4);
    });

    it('refuses a sale of an unknown dish or one not sold on the day, and bad bodies', async () => {
      const { owner } = await people();
      expect(errorOf(await sell(owner, 'nope'))).toBe('unknown_item');
      expect((await sell(owner, 'pesmol')).status).toBe(400); // no day stock yet
      for (const body of [
        {},
        { itemId: 'pesmol' },
        { itemId: 'pesmol', qty: 0 },
        { itemId: 'pesmol', qty: 1.5 },
      ]) {
        expect(
          (await call('POST', '/api/seller/day/sale', { token: owner.token, body })).status,
        ).toBe(400);
      }
      expect(
        (
          await call('POST', '/api/seller/day/count', {
            token: owner.token,
            body: { itemId: 'pesmol', count: -1 },
          })
        ).status,
      ).toBe(400);
    });

    it('owners and helpers may sell; a chef and a signed-out customer may not', async () => {
      const { owner, helper, chef } = await people();
      await patchItem(owner, 'pesmol', { dayStock: 5 });
      expect((await sell(helper, 'pesmol')).status).toBe(200);
      expect((await setCount(helper, 'pesmol', 9)).status).toBe(200);
      expect((await call('GET', '/api/seller/day/log', { token: helper.token })).status).toBe(200);
      expect((await sell(owner, 'pesmol')).status).toBe(200);

      expect((await sell(chef, 'pesmol')).status).toBe(403);
      expect((await setCount(chef, 'pesmol', 1)).status).toBe(403);
      expect((await call('GET', '/api/seller/day/log', { token: chef.token })).status).toBe(403);

      const anon = { token: 'not-a-session' };
      expect((await sell(anon, 'pesmol')).status).toBe(401);
      expect((await setCount(anon, 'pesmol', 1)).status).toBe(401);
      expect((await call('GET', '/api/seller/day/log', anon)).status).toBe(401);
      // A helper still may not edit the day stock through the item PATCH.
      expect((await patchItem(helper, 'pesmol', { dayStock: 99 })).status).toBe(403);
    });
  });

  describe('stage 4: undo and correcting the log', () => {
    const undo = (who: Person, entryId: string) =>
      call('POST', '/api/seller/day/undo', { token: who.token, body: { entryId } });
    const entryIdOf = (reply: Reply) => parseDayStockResponse(reply.body)?.entryId ?? '';

    it('undo gives the portions back, marks the sale undone and logs an undo row', async () => {
      const { owner, helper } = await people();
      await setCount(owner, 'pesmol', 5);
      const sold = await sell(helper, 'pesmol', 2);
      expect(stockOf(sold)).toBe(3);
      const back = await undo(helper, entryIdOf(sold));
      expect(back.status).toBe(200);
      expect(stockOf(back)).toBe(5);
      const entries = await log(owner);
      expect(entries.map((e) => [e.kind, e.change, e.stockAfter, e.undone])).toEqual([
        ['undo', 2, 5, false],
        ['sale', -2, 3, true],
        ['count', 5, 5, false],
      ]);
      // A second undo of the same sale is refused and changes nothing.
      expect((await undo(owner, entryIdOf(sold))).status).toBe(400);
      expect(stockOf(await sell(owner, 'pesmol', 5))).toBe(0);
    });

    it('two undos at once return the portions only once', async () => {
      const { owner } = await people();
      await setCount(owner, 'pesmol', 4);
      const id = entryIdOf(await sell(owner, 'pesmol', 3));
      const replies = await Promise.all([undo(owner, id), undo(owner, id)]);
      expect(replies.map((r) => r.status).sort()).toEqual([200, 400]);
      expect(stockOf(await setCount(owner, 'pesmol', 4))).toBe(4); // already 4: no row, still 4
      expect((await log(owner)).filter((e) => e.kind === 'undo')).toHaveLength(1);
    });

    it('a helper undoes only their own sale, within the window; the owner any sale any time', async () => {
      const { owner, helper, chef } = await people();
      await setCount(owner, 'pesmol', 9);
      const ownersSale = entryIdOf(await sell(owner, 'pesmol'));
      const helpersSale = entryIdOf(await sell(helper, 'pesmol'));
      const late = entryIdOf(await sell(helper, 'pesmol'));
      expect((await undo(helper, ownersSale)).status).toBe(403);
      // Make the third sale old: past the helper's window.
      await world.db
        .stmt("UPDATE day_sales SET at = '2026-10-07T09:00:00.000Z' WHERE id = ?", late)
        .run();
      expect((await undo(helper, late)).status).toBe(403);
      expect((await undo(helper, helpersSale)).status).toBe(200);
      // The owner corrects the old one and the other person's.
      expect((await undo(owner, late)).status).toBe(200);
      expect((await undo(owner, ownersSale)).status).toBe(200);
      expect((await undo(owner, 'nope')).status).toBe(404);
      expect(stockOf(await setCount(owner, 'pesmol', 9))).toBe(9);
      expect((await undo(chef, helpersSale)).status).toBe(403); // a chef cannot undo
    });
  });

  describe('retention', () => {
    it('drops log rows older than 10 weeks and keeps newer ones', async () => {
      const { owner } = await people();
      await setCount(owner, 'pesmol', 3);
      const db = world.db;
      // One row 11 weeks old, the other is now.
      const old = new Date(START - 11 * 7 * 86_400_000).toISOString();
      await db
        .stmt(
          `INSERT INTO day_sales (id, seller_id, menu_id, item_id, kind, change, stock_after, by_name, at)
           SELECT 'old-1', seller_id, menu_id, item_id, kind, change, stock_after, by_name, ? FROM day_sales LIMIT 1`,
          old,
        )
        .run();
      expect(await dropOldDaySales(db, new Date(START))).toBe(1);
      expect(await dropOldDaySales(db, new Date(START))).toBe(0);
      expect(await log(owner)).toHaveLength(1);
    });
  });
});

describe('migration 0011 (day selling)', () => {
  let database: Database;
  beforeEach(async () => {
    database = await openDatabase('daySellingMigration-d1', '0010_helper.sql');
  });

  it('old dishes and menu items read preorder = 1 and day_stock NULL', async () => {
    const db = new Db(database.d1);
    await db
      .stmt("INSERT INTO sellers (id, slug, name, created_at) VALUES ('s1', 'one', 'One', 'x')")
      .run();
    await db
      .stmt(
        "INSERT INTO dishes (seller_id, id, name_en, name_id, price_cents, created_at) VALUES ('s1', 'd1', 'A', 'A', 100, 'x')",
      )
      .run();
    await db
      .stmt(
        "INSERT INTO menu_items (seller_id, id, position, name_en, name_id, price_cents) VALUES ('s1', 'i1', 0, 'A', 'A', 100)",
      )
      .run();
    await database.migrateAll();
    for (const table of ['dishes', 'menu_items']) {
      const row = await db.first<{ preorder: number; day_stock: number | null }>(
        `SELECT preorder, day_stock FROM ${table}`,
      );
      expect(row).toEqual({ preorder: 1, day_stock: null });
    }
    expect(await db.first('SELECT 1 AS n FROM day_sales')).toBeNull();
    await database.close();
  });
});
