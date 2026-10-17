// @vitest-environment node
// Plan 081 stages 1-2: private (Khusus) orders. Data, repository and routes: no effect on the menu,
// the role matrix, customer writes refused, due counts, the address wipe at the kitchen-zone day
// boundary, deletion with a stub, and the LIVE_MENU guard.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseApiError } from '../shared/apiError';
import type { DeliveryAddress } from '../shared/address';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import type { SellerOrder } from '../shared/domain';
import { parseCustomerOrderResponse, parseSellerOrderResponse } from '../shared/orderContract';
import type { PrivateChefSummaryResponse, PrivateListResponse } from '../shared/privateContract';
import { runAddressSweep, runRetention } from '../worker/api/scheduled';
import { importAddressKey } from '../worker/db/address';
import { finishDueMenus } from '../worker/db/menus';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const OTHER_ID = 'seller-dapur-demo';
const SLUG = 'onde-onde';
// 20:30 on 7 Oct in Adelaide (ACDT, +10:30).
const START = Date.parse('2026-10-07T10:00:00Z');
const SECRET = Buffer.alloc(32, 9).toString('base64');
const ADDRESS: DeliveryAddress = {
  street: '9 Birthday Lane',
  suburb: 'Norwood',
  postcode: '5067',
  notes: 'Balloons on the gate',
  lat: -34.9,
  lng: 138.63,
};

describe('private orders (plan 081)', () => {
  const create = useWorld('private-orders');
  let world: World;
  let now = START;
  let tokens = 0;
  let key: CryptoKey | null;

  type Reply = { status: number; body: unknown; setCookie: string | null; text: string };
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
      new Request(`https://private.test${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
      { addressKey: key },
    );
    if (!response) return { status: -1, body: null, setCookie: null, text: '' };
    const text = await response.text();
    const setCookie = response.headers.get('set-cookie');
    try {
      return { status: response.status, body: JSON.parse(text) as unknown, setCookie, text };
    } catch {
      return { status: response.status, body: text, setCookie, text };
    }
  }

  function session(reply: Reply) {
    const parsed = parseSessionResponse(reply.body);
    const token = /__Host-session=([^;]+)/.exec(reply.setCookie ?? '')?.[1];
    if (!parsed || !token) throw new Error(`not a session: ${reply.text}`);
    return { ...parsed, token };
  }
  async function newPerson(inviteKey: string, deviceId: string) {
    const setup = session(
      await call('POST', '/api/auth/invite', { body: { key: inviteKey, deviceId } }),
    );
    return session(
      await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password: 'a long enough password', deviceName: 'Phone' },
      }),
    );
  }
  const keyOf = (reply: Reply) => parseKeyResponse(reply.body)?.key ?? '';
  async function people() {
    const made = await world.repo.auth.createKey({
      role: 'owner',
      sellerId: SELLER_ID,
      displayName: 'olive',
    });
    const boss = await newPerson(made.key, 'olive-0001-aaaa');
    const helper = await newPerson(
      keyOf(
        await call('POST', '/api/seller/invites', {
          token: boss.token,
          body: { displayName: 'Dewi', role: 'helper' },
        }),
      ),
      'helper-0001-bb',
    );
    const chef = await newPerson(
      keyOf(
        await call('POST', '/api/seller/chef-invites', {
          token: boss.token,
          body: { chefId: 'wati' },
        }),
      ),
      'wati-0001-bbbb',
    );
    return { boss, helper, chef };
  }

  type Dish = { id: string; priceCents: number; chefId: string | null };
  async function dishes(sellerId = SELLER_ID): Promise<Array<Dish>> {
    return (
      await world.db.all<{ id: string; price_cents: number; chef_id: string | null }>(
        'SELECT id, price_cents, chef_id FROM dishes WHERE seller_id = ? ORDER BY id',
        sellerId,
      )
    ).map((row) => ({ id: row.id, priceCents: row.price_cents, chefId: row.chef_id }));
  }

  async function makePrivate(
    token: string,
    extra: Record<string, unknown> = {},
    status = 201,
  ): Promise<SellerOrder> {
    const [a, b] = await dishes();
    const reply = await call('POST', '/api/seller/private', {
      token,
      body: {
        firstName: 'Ibu Sari',
        language: 'id',
        eventDate: '2026-10-10',
        eventTime: '18:00',
        lines: [
          { dishId: a?.id, qty: 2, priceCents: 5000 },
          { dishId: b?.id, qty: 1 },
        ],
        depositCents: 2000,
        address: ADDRESS,
        note: 'Birthday',
        ...extra,
      },
    });
    expect(reply.status, reply.text).toBe(status);
    const order = parseSellerOrderResponse(reply.body)?.order;
    if (!order) throw new Error(reply.text);
    return order;
  }

  const count = async (sql: string, ...args: Array<string>) =>
    (await world.db.first<{ n: number }>(sql, ...args))?.n;

  beforeEach(async () => {
    now = START;
    tokens = 0;
    key = await importAddressKey(SECRET);
    world = await create({
      now: () => new Date(now),
      newToken: () => `token-${String(++tokens)}-padding-padding`,
    });
    await world.db.stmt("UPDATE menus SET state = 'live'").run();
  });

  it('creates a delivery order from library dishes with per-order qty and price', async () => {
    const { boss } = await people();
    const [a, b] = await dishes();
    const order = await makePrivate(boss.token);
    expect(order.fulfilment).toBe('delivery');
    expect(order.status).toBe('confirmed');
    expect(order.paid).toBe(false);
    expect(order.private).toEqual({
      eventDate: '2026-10-10',
      eventTime: '18:00',
      depositCents: 2000,
    });
    expect(order.lines.map((l) => [l.itemId, l.qty, l.priceCents])).toEqual([
      [a?.id, 2, 5000],
      [b?.id, 1, b?.priceCents],
    ]);
    expect(order.lines[0]?.chefId).toBe(a?.chefId ?? undefined);
    expect(order.enteredBy?.role).toBe('seller');
    // The address is team-only and stored encrypted.
    const read = await call('GET', `/api/seller/orders/${order.code}`, boss);
    expect(read.status).toBe(200);
    const cipher = await world.db.first<{ address_enc: string }>(
      'SELECT address_enc FROM orders WHERE code = ?',
      order.code,
    );
    expect(cipher?.address_enc).toBeTruthy();
    expect(cipher?.address_enc).not.toContain('Birthday Lane');
    // Pickup: no address kept.
    const pickup = await makePrivate(boss.token, { fulfilment: 'pickup', address: undefined });
    expect(pickup.fulfilment).toBe('pickup');
    // Moving the delivery order to pickup drops the address.
    const patched = await call('PATCH', `/api/seller/private/${order.code}`, {
      ...boss,
      body: { fulfilment: 'pickup' },
    });
    expect(patched.status).toBe(200);
    expect(
      (
        await world.db.first<{ address_enc: string | null }>(
          'SELECT address_enc FROM orders WHERE code = ?',
          order.code,
        )
      )?.address_enc,
    ).toBeNull();
  });

  it('updates fields and lines, keeps the event, and refuses edits once cancelled', async () => {
    const { boss } = await people();
    const order = await makePrivate(boss.token);
    const [a] = await dishes();
    const patch = await call('PATCH', `/api/seller/private/${order.code}`, {
      ...boss,
      body: {
        firstName: 'Ibu Tri',
        eventDate: '2026-10-12',
        eventTime: null,
        depositCents: null,
        paid: true,
        note: '',
        lines: [{ dishId: a?.id, qty: 5 }],
      },
    });
    expect(patch.status, patch.text).toBe(200);
    const next = parseSellerOrderResponse(patch.body)?.order;
    expect(next?.firstName).toBe('Ibu Tri');
    expect(next?.private).toEqual({ eventDate: '2026-10-12' });
    expect(next?.paid).toBe(true);
    expect(next?.note).toBeUndefined();
    expect(next?.lines.map((l) => [l.itemId, l.qty])).toEqual([[a?.id, 5]]);
    const cancelled = await call('POST', `/api/seller/private/${order.code}/cancel`, boss);
    expect(cancelled.status).toBe(200);
    expect(parseSellerOrderResponse(cancelled.body)?.order.status).toBe('cancelled');
    expect(
      (
        await world.db.first<{ address_enc: string | null }>(
          'SELECT address_enc FROM orders WHERE code = ?',
          order.code,
        )
      )?.address_enc,
    ).toBeNull();
    const again = await call('PATCH', `/api/seller/private/${order.code}`, {
      ...boss,
      body: { note: 'x' },
    });
    expect(again.status).toBe(409);
    // A menu order's code is not a private order.
    const menuOrder = await call('POST', `/api/s/${SLUG}/orders`, {
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
      },
    });
    const menuCode = parseCustomerOrderResponse(menuOrder.body)?.order.code ?? '';
    const wrong = await call('PATCH', `/api/seller/private/${menuCode}`, {
      ...boss,
      body: { note: 'x' },
    });
    expect(wrong.status).toBe(404);
  });

  it('has no effect on stock, portion guard, finish, auto-finish, lists, CSV, backup or chef snapshot', async () => {
    const { boss } = await people();
    const seller = await world.repo.sellerBySlug(SLUG);
    if (!seller) throw new Error('no seller');
    // A menu order and a limited item whose id is also a library dish id.
    const menu = await seller.getSellerMenu();
    const target = menu.items[0];
    if (!target) throw new Error('no item');
    const dish = (await dishes()).find((d) => d.id === target.id);
    expect(dish).toBeDefined();
    await world.db
      .stmt(
        'UPDATE menu_items SET portion_limit = 3 WHERE seller_id = ? AND id = ?',
        SELLER_ID,
        target.id,
      )
      .run();
    const before = await seller.getSellerMenu();
    const beforeChefs = await call('GET', '/api/seller/menus/current/chef-summary', boss);
    const beforeBackup = (await call('GET', '/api/seller/backup', boss)).body as {
      orders: Array<unknown>;
      pastWeeks: Array<unknown>;
    };
    const dishId = dish?.id ?? (await dishes())[0]?.id;
    await makePrivate(boss.token, { lines: [{ dishId, qty: 99 }] });
    // Stock and the remaining count are untouched (the lines are even the same id when the dish is the item).
    const after = await seller.getSellerMenu();
    expect(after.items.map((i) => [i.id, i.remaining])).toEqual(
      before.items.map((i) => [i.id, i.remaining]),
    );
    expect(after.items.find((i) => i.id === target.id)?.remaining).toBe(3);
    // The portion guard does not count it: a menu order may take all 3.
    const placed = await call('POST', `/api/s/${SLUG}/orders`, {
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: target.id, qty: 3 }],
      },
    });
    expect(placed.status, placed.text).toBe(201);
    // The menu's order list and CSV and backup know only the menu order.
    const list = (await call('GET', '/api/seller/orders', boss)).body as {
      orders: Array<SellerOrder>;
    };
    expect(list.orders.map((o) => o.firstName)).toEqual(['Rina']);
    const csv = (await call('GET', '/api/seller/orders.csv', boss)).text;
    expect(csv).not.toContain('Ibu Sari');
    expect(csv).toContain('Rina');
    const backup = (await call('GET', '/api/seller/backup', boss)).body as typeof beforeBackup;
    expect(backup.orders).toHaveLength(beforeBackup.orders.length + 1);
    expect(JSON.stringify(backup)).not.toContain('Ibu Sari');
    // The chef snapshot is menu only.
    const afterChefs = await call('GET', '/api/seller/menus/current/chef-summary', boss);
    expect(afterChefs.status).toBe(beforeChefs.status);
    expect(JSON.stringify(afterChefs.body)).not.toContain('"cents":495');
    // Auto-finish after the cooking day, and a manual finish, leave it alone and live.
    const privateRow = () =>
      world.db.first<{ past_week_id: string | null; status: string }>(
        "SELECT past_week_id, status FROM orders WHERE kind = 'private'",
      );
    await finishDueMenus(world.db, new Date(Date.parse('2026-10-20T00:00:00Z')));
    expect(await privateRow()).toEqual({ past_week_id: null, status: 'confirmed' });
    await seller.publishMenu();
    await seller.finishMenuNow();
    expect(await privateRow()).toEqual({ past_week_id: null, status: 'confirmed' });
    expect(
      await count("SELECT COUNT(*) AS n FROM orders WHERE kind = 'menu' AND past_week_id IS NULL"),
    ).toBe(0);
    // Still reachable by its code and in the private list.
    const upcoming = (await call('GET', '/api/seller/private', boss)).body as PrivateListResponse;
    expect(upcoming.orders).toHaveLength(1);
  });

  it('role matrix: owner writes; chef and helper read and move the status only', async () => {
    const { boss, helper, chef } = await people();
    const order = await makePrivate(boss.token);
    const body = { dishId: (await dishes())[0]?.id, qty: 1 };
    for (const who of [chef, helper]) {
      expect((await call('GET', '/api/seller/private', who)).status).toBe(200);
      expect((await call('GET', '/api/seller/private?due=1', who)).status).toBe(200);
      const create403 = await call('POST', '/api/seller/private', {
        ...who,
        body: { firstName: 'X', language: 'en', eventDate: '2026-10-10', lines: [body] },
      });
      expect(create403.status).toBe(403);
      expect(
        (await call('PATCH', `/api/seller/private/${order.code}`, { ...who, body: { note: 'x' } }))
          .status,
      ).toBe(403);
      expect((await call('POST', `/api/seller/private/${order.code}/cancel`, who)).status).toBe(
        403,
      );
    }
    // Status moves work for both, under their own name.
    const moved = await call('POST', `/api/seller/orders/${order.code}/status`, {
      ...helper,
      body: { to: 'out_for_delivery', force: true },
    });
    expect(moved.status, moved.text).toBe(200);
    const cooked = await call('POST', `/api/seller/orders/${order.code}/status`, {
      ...chef,
      body: { to: 'delivered', force: true },
    });
    expect(cooked.status, cooked.text).toBe(200);
    // Cancel and paid on a private order are owner only, also through the order routes.
    const second = await makePrivate(boss.token);
    const chefCancel = await call('POST', `/api/seller/orders/${second.code}/status`, {
      ...chef,
      body: { to: 'cancelled', force: true },
    });
    expect(chefCancel.status).toBe(403);
    const chefPaid = await call('POST', `/api/seller/orders/${second.code}/paid`, {
      ...chef,
      body: { paid: true },
    });
    expect(chefPaid.status).toBe(403);
    expect(
      (
        await call('POST', `/api/seller/orders/${second.code}/paid`, {
          ...boss,
          body: { paid: true },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call('POST', `/api/seller/orders/${second.code}/status`, {
          ...boss,
          body: { to: 'cancelled', force: true },
        })
      ).status,
    ).toBe(200);
    // A signed-out caller gets nothing (the dev header path is the only other door, owner-level).
    const anon = await devApi(
      world.repo,
      new Request('https://private.test/api/seller/private', {
        method: 'POST',
        headers: { 'X-Actor': 'chef:Wati', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'X',
          language: 'en',
          eventDate: '2026-10-10',
          lines: [body],
        }),
      }),
      { addressKey: key },
    );
    expect(anon?.status).toBe(403);
  });

  it('customers read their private order but cannot change, cancel or collect it', async () => {
    const { boss } = await people();
    const order = await makePrivate(boss.token);
    const read = await call('GET', `/api/orders/${order.token}`);
    expect(read.status).toBe(200);
    const customer = parseCustomerOrderResponse(read.body)?.order;
    // 2 x 5000 + 1 x the second dish's price, less the 2000 deposit.
    const total = order.lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
    expect(customer?.private).toEqual({
      eventDate: '2026-10-10',
      eventTime: '18:00',
      depositCents: 2000,
      toPayCents: total - 2000,
    });
    expect(read.text).not.toContain('chefId');
    expect(read.text).not.toContain('Birthday Lane');
    for (const [method, tail, body] of [
      ['PATCH', '', { note: 'hi' }],
      ['POST', '/cancel', undefined],
      ['POST', '/collected', undefined],
    ] as const) {
      const reply = await call(method, `/api/orders/${order.token}${tail}`, {
        ...(body ? { body } : {}),
      });
      expect(reply.status, `${method} ${tail}`).toBe(403);
      expect(parseApiError(reply.body)?.error).toBe('private_order');
    }
    // Once paid, nothing is left to pay.
    await call('POST', `/api/seller/orders/${order.code}/paid`, { ...boss, body: { paid: true } });
    const paid = parseCustomerOrderResponse((await call('GET', `/api/orders/${order.token}`)).body);
    expect(paid?.order.private?.toPayCents).toBe(0);
    // The customer's list (My orders) carries it too.
    const mine = await call('GET', `/api/orders?tokens=${order.token}`);
    expect(mine.text).toContain('toPayCents');
  });

  it('lists upcoming and past, today and the due counts, in the kitchen time zone', async () => {
    const { boss } = await people();
    const a = await makePrivate(boss.token, { eventDate: '2026-10-07', eventTime: '12:00' });
    const b = await makePrivate(boss.token, { eventDate: '2026-10-08', firstName: 'B' });
    const c = await makePrivate(boss.token, { eventDate: '2026-10-10', firstName: 'C' });
    const past = await makePrivate(boss.token, { eventDate: '2026-10-05', firstName: 'P' });
    const cancelled = await makePrivate(boss.token, { eventDate: '2026-10-09', firstName: 'X' });
    await call('POST', `/api/seller/private/${cancelled.code}/cancel`, boss);
    const get = async (query: string) =>
      (await call('GET', `/api/seller/private${query}`, boss)).body as PrivateListResponse;

    const upcoming = await get('');
    expect(upcoming.today).toBe('2026-10-07');
    expect(upcoming.orders.map((o) => o.code)).toEqual([a.code, b.code, c.code]);
    expect(upcoming.due).toEqual({ today: 1, tomorrow: 1 });
    const pastList = await get('?view=past');
    expect(pastList.orders.map((o) => o.code)).toEqual([cancelled.code, past.code]);
    expect((await get('?day=today')).orders.map((o) => o.code)).toEqual([a.code]);
    const due = await get('?due=1');
    expect(due.orders).toEqual([]);
    expect(due.due).toEqual({ today: 1, tomorrow: 1 });
    expect((await call('GET', '/api/seller/private?view=nope', boss)).status).toBe(400);
    // The addresses ride on the list, team-only.
    expect(upcoming.orders[0]).toHaveProperty('address');

    // 00:30 on 8 Oct in Adelaide is still 7 Oct in UTC: the kitchen's day is what counts.
    now = Date.parse('2026-10-07T14:00:00Z');
    const later = await get('');
    expect(later.today).toBe('2026-10-08');
    expect(later.orders.map((o) => o.code)).toEqual([b.code, c.code]);
    expect(later.due).toEqual({ today: 1, tomorrow: 0 });
    expect((await get('?view=past')).orders.map((o) => o.code)).toEqual([
      cancelled.code,
      a.code,
      past.code,
    ]);
  });

  it('sums a day per chef from the lines, cancelled orders excluded', async () => {
    const { boss } = await people();
    const [a] = await dishes();
    await makePrivate(boss.token, { lines: [{ dishId: a?.id, qty: 2, priceCents: 1000 }] });
    const gone = await makePrivate(boss.token, {
      lines: [{ dishId: a?.id, qty: 9, priceCents: 1000 }],
    });
    await call('POST', `/api/seller/private/${gone.code}/cancel`, boss);
    const summary = (await call('GET', '/api/seller/private/chef-summary?date=2026-10-10', boss))
      .body as PrivateChefSummaryResponse;
    expect(summary.date).toBe('2026-10-10');
    expect(summary.rows).toEqual([
      {
        chefId: a?.chefId ?? null,
        ...(a?.chefId ? { chefName: expect.any(String) as string } : {}),
        qty: 2,
        cents: 2000,
      },
    ]);
    expect((await call('GET', '/api/seller/private/chef-summary?date=nope', boss)).status).toBe(
      400,
    );
  });

  it('chef summary follows the plan 069 income rules: owner all, chef own, helper never', async () => {
    const { boss, helper, chef } = await people();
    const all = await dishes();
    const mine = all.find((d) => d.chefId === 'wati');
    const other = all.find((d) => d.chefId !== 'wati');
    await makePrivate(boss.token, {
      lines: [
        { dishId: mine?.id, qty: 2, priceCents: 1000 },
        { dishId: other?.id, qty: 3, priceCents: 500 },
      ],
    });
    const url = '/api/seller/private/chef-summary?date=2026-10-10';
    const rowsOf = async (who: { token: string }) =>
      ((await call('GET', url, who)).body as PrivateChefSummaryResponse).rows;
    const ownerRows = await rowsOf(boss);
    expect(ownerRows.length).toBeGreaterThan(1);
    expect((await rowsOf(chef)).map((r) => [r.chefId, r.qty, r.cents])).toEqual([
      ['wati', 2, 2000],
    ]);
    expect((await call('GET', url, helper)).status).toBe(403);
    const setting = (chefsSeeIncome: boolean) =>
      call('PUT', '/api/seller/preferences', { token: boss.token, body: { chefsSeeIncome } });
    expect((await setting(false)).status).toBe(200);
    expect((await call('GET', url, chef)).status).toBe(403);
    expect(await rowsOf(boss)).toEqual(ownerRows);
    expect((await call('GET', url, helper)).status).toBe(403);
  });

  it('wipes the address at the kitchen-zone day boundary after the event', async () => {
    const { boss } = await people();
    const order = await makePrivate(boss.token, { eventDate: '2026-10-10' });
    const stored = async () =>
      (
        await world.db.first<{ address_enc: string | null }>(
          'SELECT address_enc FROM orders WHERE code = ?',
          order.code,
        )
      )?.address_enc;
    const sweep = (iso: string) => runAddressSweep({ DB: world.db.d1 }, new Date(iso));
    // 12 Oct 00:00 in Adelaide (+10:30) is 11 Oct 13:30 UTC; the 11th local is still the day after.
    expect(await sweep('2026-10-11T13:29:00Z')).toBe(0);
    expect(await stored()).not.toBeNull();
    expect(await sweep('2026-10-11T13:31:00Z')).toBe(1);
    expect(await stored()).toBeNull();
    expect(await sweep('2026-10-12T13:31:00Z')).toBe(0);
  });

  it('deletes the order four weeks after the event and leaves an archived stub', async () => {
    const { boss } = await people();
    const order = await makePrivate(boss.token, { eventDate: '2026-10-10' });
    const run = (iso: string) => runRetention({ DB: world.db.d1 }, new Date(iso), () => undefined);
    expect((await run('2026-11-06T03:00:00Z')).orders).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM orders WHERE kind = 'private'")).toBe(1);
    expect((await run('2026-11-09T03:00:00Z')).orders).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM orders WHERE kind = 'private'")).toBe(0);
    const stub = await world.db.first<{ cooking_date: string }>(
      'SELECT cooking_date FROM expired_orders WHERE token = ?',
      order.token,
    );
    expect(stub?.cooking_date).toBe('2026-10-10');
    expect(await count('SELECT COUNT(*) AS n FROM order_lines WHERE order_id = ?', order.id)).toBe(
      0,
    );
    const read = await call('GET', `/api/orders/${order.token}`);
    expect(read.status).toBe(200);
    expect(read.text).toContain('"expired":');
  });

  it('a backup restore leaves private orders alone', async () => {
    const { boss } = await people();
    const order = await makePrivate(boss.token);
    const file = (await call('GET', '/api/seller/backup', boss)).body;
    const restored = await call('POST', '/api/seller/backup', { ...boss, body: file });
    expect(restored.status, restored.text).toBe(200);
    const row = await world.db.first<{ kind: string; lines: number }>(
      `SELECT o.kind AS kind, (SELECT COUNT(*) FROM order_lines l WHERE l.order_id = o.id) AS lines
       FROM orders o WHERE o.code = ?`,
      order.code,
    );
    expect(row).toEqual({ kind: 'private', lines: 2 });
    expect(await count('SELECT COUNT(*) AS n FROM order_audit WHERE order_id = ?', order.id)).toBe(
      1,
    );
  });

  it("validates the request and only takes this kitchen's library dishes", async () => {
    const { boss } = await people();
    const [a] = await dishes();
    const base = {
      firstName: 'Ibu',
      language: 'en',
      eventDate: '2026-10-10',
      lines: [{ dishId: a?.id, qty: 1 }],
    };
    const post = (body: unknown) => call('POST', '/api/seller/private', { ...boss, body });
    expect((await post({ ...base })).status).toBe(201);
    expect((await post({ ...base, eventDate: undefined })).status).toBe(400);
    expect((await post({ ...base, eventDate: '2026-13-40' })).status).toBe(400);
    expect((await post({ ...base, eventTime: '25:00' })).status).toBe(400);
    expect((await post({ ...base, lines: [{ dishId: a?.id, qty: 100 }] })).status).toBe(400);
    expect((await post({ ...base, lines: [{ dishId: a?.id, qty: 0 }] })).status).toBe(400);
    expect(
      (await post({ ...base, lines: [{ dishId: a?.id, qty: 1, priceCents: -1 }] })).status,
    ).toBe(400);
    expect((await post({ ...base, lines: [] })).status).toBe(400);
    expect((await post({ ...base, firstName: 'x'.repeat(41) })).status).toBe(400);
    expect((await post({ ...base, note: 'x'.repeat(201) })).status).toBe(400);
    expect((await post({ ...base, depositCents: -5 })).status).toBe(400);
    const tooMuch = await post({ ...base, depositCents: 5_000_00 });
    expect(tooMuch.status).toBe(400);
    const created = await post({ ...base, depositCents: 100 });
    expect(created.status).toBe(201);
    const code = parseSellerOrderResponse(created.body)?.order.code;
    const patchHigh = await call('PATCH', `/api/seller/private/${code}`, {
      ...boss,
      body: { depositCents: 5_000_00 },
    });
    expect(patchHigh.status).toBe(400);
    expect((await post({ ...base, phone: '0400000000' })).status).toBe(400);
    expect(
      (
        await post({
          ...base,
          lines: [
            { dishId: a?.id, qty: 1 },
            { dishId: a?.id, qty: 2 },
          ],
        })
      ).status,
    ).toBe(400);
    const many = (await dishes()).slice(0, 2);
    const fifty1 = Array.from({ length: 51 }, (_, i) => ({ dishId: many[i % 2]?.id, qty: 1 }));
    expect((await post({ ...base, lines: fifty1 })).status).toBe(400);
    const unknown = await post({ ...base, lines: [{ dishId: 'no-such-dish', qty: 1 }] });
    expect(unknown.status).toBe(400);
    expect(parseApiError(unknown.body)?.error).toBe('unknown_item');
    const foreign = (await dishes(OTHER_ID))[0];
    expect(foreign).toBeDefined();
    if (foreign && !(await dishes()).some((d) => d.id === foreign.id)) {
      const reply = await post({ ...base, lines: [{ dishId: foreign.id, qty: 1 }] });
      expect(parseApiError(reply.body)?.error).toBe('unknown_item');
    }
    expect((await call('PATCH', '/api/seller/private/ABCDEF', { ...boss, body: {} })).status).toBe(
      400,
    );
  });
});

describe('LIVE_MENU guard (plan 081)', () => {
  // A bare `past_week_id IS NULL` also matches private orders. Menu queries must use liveMenu()/
  // LIVE_MENU; only these deliberately kind-blind sites (by code or token) may keep the raw text.
  const ALLOWED: Record<string, number> = {
    'orders.ts': 4, // liveMenu() itself, two doc comments, readLiveOrder (by code or token)
    'index.ts': 1, // lookupMany: a customer's token finds a private order too
    'push.ts': 1, // a customer subscribes to push for their private order
    'seller.ts': 3, // setOrderAddress, orderAddresses, sendUpdates (by code)
  };

  it('keeps raw past_week_id IS NULL out of worker/db except the allow-list', () => {
    const dir = path.resolve('worker/db');
    const found: Record<string, number> = {};
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const hits = readFileSync(path.join(dir, file), 'utf8').match(/past_week_id IS NULL/g);
      if (hits) found[file] = hits.length;
    }
    expect(found).toEqual(ALLOWED);
  });
});
