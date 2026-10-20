// @vitest-environment node
// Plan 114 item 2: the same clientOrderId again (the answer was lost) returns the order already made.
// Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import type { DeliveryAddress } from '../shared/address';
import { importAddressKey } from '../worker/db/address';
import { parseCreateOrderRequest, type CreateOrderRequest } from '../shared/orderContract';
import { handleApiRequest } from '../worker/api/routes';
import { useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');
const ID = '7d444840-9dc0-11d1-b245-5ffdce74fad2';

function order(firstName: string, extra: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return {
    firstName,
    language: 'en',
    fulfilment: 'pickup',
    lines: [{ itemId: 'pesmol', qty: 1 }],
    ...extra,
  };
}

describe('client order id', () => {
  const create = useWorld('client-order-id');
  let world: World;
  let n = 0;
  let clock = NOW;

  const seller = async () => {
    const handle = await world.repo.sellerBySlug('onde-onde');
    if (!handle) throw new Error('no seller');
    return handle;
  };
  const orders = async () =>
    (await world.db.first<{ n: number }>('SELECT COUNT(*) AS n FROM orders'))?.n;
  const used = async () =>
    (
      await world.db.first<{ n: number }>(
        `SELECT COALESCE(SUM(qty), 0) AS n FROM order_lines WHERE item_id = 'pesmol'`,
      )
    )?.n;

  beforeEach(async () => {
    clock = NOW;
    world = await create({
      now: () => clock,
      newToken: () => `token-${String(++n)}-padding-padding`,
    });
  });

  it('returns the first order for a repeat, and does not take portions twice', async () => {
    await world.db.stmt("UPDATE menu_items SET portion_limit = 1 WHERE id = 'pesmol'").run();
    const onde = await seller();
    const first = await onde.createOrder(order('Rina', { clientOrderId: ID }));
    const again = await onde.createOrder(order('Rina', { clientOrderId: ID }));
    expect(first.ok && again.ok).toBe(true);
    expect(again.ok && first.ok && again.value.code).toBe(first.ok && first.value.code);
    expect(again.ok && first.ok && again.value.token).toBe(first.ok && first.value.token);
    expect(await orders()).toBe(1);
    expect(await used()).toBe(1);
    expect((await onde.orderByClientId(ID))?.firstName).toBe('Rina');
  });

  it('makes a new order for a different id, or for no id (old apps)', async () => {
    const onde = await seller();
    await onde.createOrder(order('Rina', { clientOrderId: ID }));
    await onde.createOrder(order('Tom', { clientOrderId: 'another-id-0001-another-id-0001' }));
    await onde.createOrder(order('Ana'));
    await onde.createOrder(order('Ana'));
    expect(await orders()).toBe(4);
  });

  it('forgets the id after 24 hours', async () => {
    const onde = await seller();
    await onde.createOrder(order('Rina', { clientOrderId: ID }));
    expect(await onde.orderByClientId(ID)).toBeDefined();
    clock = new Date(NOW.getTime() + 25 * 60 * 60 * 1000);
    expect(await onde.orderByClientId(ID)).toBeUndefined();
  });

  it('answers two racing sends of the same id with one order', async () => {
    const onde = await seller();
    const results = await Promise.all([
      onde.createOrder(order('Rina', { clientOrderId: ID })),
      onde.createOrder(order('Rina', { clientOrderId: ID })),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await orders()).toBe(1);
  });

  it('parses an optional, uuid-like id and refuses a bad one', () => {
    const body = order('Rina');
    expect(parseCreateOrderRequest(body)).not.toHaveProperty('clientOrderId');
    expect(parseCreateOrderRequest({ ...body, clientOrderId: ID })).toMatchObject({
      clientOrderId: ID,
    });
    // A malformed id is ignored, the order is still accepted.
    for (const bad of ['x'.repeat(65), 'a b; drop', 5, null, 'short', 'a'.repeat(31)]) {
      const parsed = parseCreateOrderRequest({ ...body, clientOrderId: bad });
      expect(parsed).not.toBeNull();
      expect(parsed).not.toHaveProperty('clientOrderId');
    }
  });

  it('a cancelled first order: the retry creates a new order and the old row lets go of the id', async () => {
    const onde = await seller();
    const first = await onde.createOrder(order('Rina', { clientOrderId: ID }));
    await world.db.stmt("UPDATE orders SET status = 'cancelled'").run();
    expect(await onde.orderByClientId(ID)).toBeUndefined();
    const again = await onde.createOrder(order('Rina', { clientOrderId: ID }));
    expect(again.ok && first.ok && again.value.token !== first.value.token).toBe(true);
    expect(await orders()).toBe(2);
    expect((await onde.orderByClientId(ID))?.token).toBe(again.ok ? again.value.token : '');
  });

  it('an archived order (past week) does not block a new order with the same id', async () => {
    const onde = await seller();
    await onde.createOrder(order('Rina', { clientOrderId: ID }));
    // Archive it into a past week, as closing the week does.
    await world.db
      .stmt(
        `INSERT INTO past_weeks (seller_id, id, cooking_date, closed_at, orders_count, cancelled_count, income_cents, paid_cents, unpaid_cents)
         SELECT seller_id, 'old-week', '2026-10-03', '2026-10-04T00:00:00Z', 1, 0, 0, 0, 0 FROM orders`,
      )
      .run();
    await world.db.stmt("UPDATE orders SET past_week_id = 'old-week'").run();
    expect(await onde.orderByClientId(ID)).toBeUndefined();
    const again = await onde.createOrder(order('Rina', { clientOrderId: ID }));
    expect(again.ok).toBe(true);
    expect(await orders()).toBe(2);
  });

  it('an order older than 24 hours does not block a new one with the same id', async () => {
    const onde = await seller();
    await onde.createOrder(order('Rina', { clientOrderId: ID }));
    clock = new Date(NOW.getTime() + 30 * 60 * 60 * 1000);
    const again = await onde.createOrder(order('Rina', { clientOrderId: ID }));
    expect(again.ok).toBe(true);
    expect(await orders()).toBe(2);
  });

  it('a private order holding the same id does not block or answer a menu order', async () => {
    const onde = await seller();
    await onde.createOrder(order('Rina'));
    await world.db.stmt("UPDATE orders SET kind = 'private', client_order_id = ?", ID).run();
    expect(await onde.orderByClientId(ID)).toBeUndefined();
    const again = await onde.createOrder(order('Rina', { clientOrderId: ID }));
    expect(again.ok).toBe(true);
    expect(await orders()).toBe(2);
  });

  it('fails open: a broken lookup still places the order', async () => {
    const onde = await seller();
    const rename = (from: string, to: string) =>
      world.db.stmt(`ALTER TABLE orders RENAME COLUMN ${from} TO ${to}`).run();
    await rename('client_order_id', 'client_order_id_x');
    try {
      // The lookup throws (no such column); the insert's own id step fails too: both fall back.
      const placed = await onde.createOrder(order('Rina', { clientOrderId: ID }));
      expect(placed.ok).toBe(true);
      expect(await orders()).toBe(1);
    } finally {
      await rename('client_order_id_x', 'client_order_id');
    }
  });

  it('over the route with ORDER_DEDUPE off: the id is ignored, every send is a new order, nothing stored', async () => {
    const post = (context: { orderDedupe?: boolean }) =>
      handleApiRequest(
        world.repo,
        new Request('https://delave.test/api/s/onde-onde/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.51' },
          body: JSON.stringify(order('Rina', { clientOrderId: ID })),
        }),
        context,
      );
    expect((await post({ orderDedupe: false }))?.status).toBe(201);
    expect((await post({ orderDedupe: false }))?.status).toBe(201);
    expect(await orders()).toBe(2);
    expect(
      (
        await world.db.first<{ n: number }>(
          'SELECT COUNT(*) AS n FROM orders WHERE client_order_id IS NOT NULL',
        )
      )?.n,
    ).toBe(0);
    // Switched back on: the same id is stored, and a repeat returns it.
    await post({ orderDedupe: true });
    await post({});
    expect(await orders()).toBe(3);
  });

  it('a repeat of a delivery order whose address was not stored saves the address', async () => {
    const key = await importAddressKey(Buffer.alloc(32, 9).toString('base64'));
    const address: DeliveryAddress = {
      street: '5 Rose Street',
      suburb: 'Norwood',
      postcode: '5067',
    };
    const post = (body: unknown) =>
      handleApiRequest(
        world.repo,
        new Request('https://delave.test/api/s/onde-onde/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.52' },
          body: JSON.stringify(body),
        }),
        { addressKey: key },
      );
    const cipher = async () =>
      (await world.db.first<{ a: string | null }>('SELECT address_enc AS a FROM orders'))?.a;
    // The first try made the order but its address step was lost.
    const base = order('Rina', { clientOrderId: ID, fulfilment: 'delivery' });
    await (await seller()).createOrder(base);
    expect(await cipher()).toBeNull();
    const again = await post({ ...base, address });
    expect(again?.status).toBe(201);
    expect(await cipher()).toBeTruthy();
    const stored = await cipher();
    // A further repeat keeps the stored address as it is.
    await post({ ...base, address: { ...address, street: '9 Other Street' } });
    expect(await cipher()).toBe(stored);
    expect(await orders()).toBe(1);
  });

  it('over the route: a repeat is a 201 with the same order and does not count for the rate limit', async () => {
    const post = async (body: unknown) => {
      const response = await handleApiRequest(
        world.repo,
        new Request('https://delave.test/api/s/onde-onde/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.50' },
          body: JSON.stringify(body),
        }),
        {},
      );
      if (!response) throw new Error('no route');
      return {
        status: response.status,
        body: (await response.json()) as { order: { code: string } },
      };
    };
    const first = await post(order('Rina', { clientOrderId: ID }));
    expect(first.status).toBe(201);
    // Ten repeats stay 201 (a new order each would hit the limit of 5) and name the same order.
    for (let i = 0; i < 10; i += 1) {
      const again = await post(order('Rina', { clientOrderId: ID }));
      expect(again.status).toBe(201);
      expect(again.body.order.code).toBe(first.body.order.code);
    }
    expect(await orders()).toBe(1);
  });
});
