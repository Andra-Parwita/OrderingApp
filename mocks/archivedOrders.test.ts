// @vitest-environment node
// D-044: closed-week orders stay readable (read-only) by their link for 4 weeks, then show as archived.
// Node, not jsdom: wrangler's local D1 (used by the d1 runs) does not work inside jsdom.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  parseCustomerOrderResponse,
  parseCustomerOrdersResponse,
  parseFetchedOrderResponse,
} from '../shared/orderContract';
import { devApi, useWorld, type World } from './impl';

const A = 'onde-onde';
const B = 'dapur-demo';
// The sample week cooks on Sat 2026-10-10; details are kept until 2026-11-07T00:00:00Z (28 days).
const COOKING = '2026-10-10';
const LAST_MOMENT = new Date('2026-11-06T23:59:59Z');
const EXACTLY_28_DAYS = new Date('2026-11-07T00:00:00Z');

describe('archived orders', () => {
  const create = useWorld('archivedOrders');
  let now: Date;
  let world: World;
  let counter = 0;

  type Reply = { status: number; body: unknown };

  async function call(
    method: string,
    path: string,
    options: { seller?: string; body?: unknown } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (options.seller) headers['X-Seller'] = options.seller;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
    );
    if (!response) throw new Error(`no route for ${method} ${path}`);
    return { status: response.status, body: (await response.json()) as unknown };
  }

  /** An unlimited dish on the seller's live sample menu. */
  async function newItem(seller: string): Promise<string> {
    const reply = await call('GET', `/api/s/${seller}/menu`);
    const items = (reply.body as { items: Array<{ id: string; limit?: number }> }).items;
    const item = items.find((candidate) => candidate.limit === undefined);
    if (!item) throw new Error('no unlimited dish on the sample menu');
    return item.id;
  }

  /** Places an order with an unlimited item and returns its token. */
  async function place(seller: string): Promise<string> {
    const itemId = await newItem(seller);
    const reply = await call('POST', `/api/s/${seller}/orders`, {
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId, qty: 2 }],
      },
    });
    return (reply.body as { order: { token: string } }).order.token;
  }

  const finishMenu = (seller: string) =>
    call('POST', '/api/seller/menus/current/finish', { seller });

  beforeEach(async () => {
    counter = 0;
    now = new Date('2026-10-07T10:00:00Z');
    world = await create({
      now: () => now,
      newId: () => `id-${String(++counter)}`,
      newToken: () => `tok-${String(++counter)}`,
    });
  });

  describe('a finished menu order, by its link', () => {
    it('is still found, read-only, with the week date and the seller', async () => {
      const token = await place(A);
      expect((await finishMenu(A)).status).toBe(200);
      const reply = await call('GET', `/api/orders/${token}`);
      expect(reply.status).toBe(200);
      const order = parseCustomerOrderResponse(reply.body)?.order;
      expect(order).toMatchObject({
        token,
        archived: true,
        cookingDate: COOKING,
        seller: { slug: A },
        status: 'collected',
      });
      expect(order?.lines).toHaveLength(1);
    });

    it('leaves a live order unmarked', async () => {
      const token = await place(A);
      const order = parseCustomerOrderResponse(
        (await call('GET', `/api/orders/${token}`)).body,
      )?.order;
      expect(order?.archived).toBeUndefined();
      expect(order?.cookingDate).toBeUndefined();
    });

    it('refuses change and cancel with 409 week_closed', async () => {
      const token = await place(A);
      await finishMenu(A);
      expect(await call('PATCH', `/api/orders/${token}`, { body: { note: 'hi' } })).toMatchObject({
        status: 409,
        body: { error: 'week_closed' },
      });
      expect(await call('POST', `/api/orders/${token}/cancel`)).toMatchObject({
        status: 409,
        body: { error: 'week_closed' },
      });
      const after = parseCustomerOrderResponse((await call('GET', `/api/orders/${token}`)).body);
      expect(after?.order.status).toBe('collected');
      expect(after?.order.note).toBeUndefined();
    });

    it('is in the My orders list, marked archived, next to a live order', async () => {
      const old = await place(A);
      await finishMenu(A);
      const live = await place(B); // B's menu is still live
      const list = parseCustomerOrdersResponse(
        (await call('GET', `/api/orders?tokens=${old},${live},unknown`)).body,
      );
      expect(list?.orders.map((o) => [o.token, o.archived ?? false])).toEqual([
        [old, true],
        [live, false],
      ]);
      expect(list?.expired).toBeUndefined();
    });

    it('is gone from the seller live list but kept in their past week', async () => {
      const token = await place(A);
      await finishMenu(A);
      const live = (await call('GET', '/api/seller/orders', { seller: A })).body as {
        orders: Array<unknown>;
      };
      expect(live.orders).toEqual([]);
      const weeks = (await call('GET', '/api/seller/past-weeks', { seller: A })).body as {
        weeks: Array<{ id: string; hasOrders: boolean }>;
      };
      expect(weeks.weeks[0]?.hasOrders).toBe(true);
      expect(token).toBeTruthy();
    });
  });

  describe('retention (cooking date + 28 days, the same clock as the seller history)', () => {
    it('still shows the order one second before 28 days', async () => {
      const token = await place(A);
      await finishMenu(A);
      now = LAST_MOMENT;
      const got = parseFetchedOrderResponse((await call('GET', `/api/orders/${token}`)).body);
      expect(got && 'order' in got && got.order.archived).toBe(true);
    });

    it('shows only the expired summary at exactly 28 days, with no items', async () => {
      const token = await place(A);
      await finishMenu(A);
      now = EXACTLY_28_DAYS;
      const reply = await call('GET', `/api/orders/${token}`);
      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({
        expired: {
          archived: true,
          expired: true,
          token,
          seller: { slug: A, name: 'Onde Onde' },
          cookingDate: COOKING,
        },
      });
      expect(parseFetchedOrderResponse(reply.body)).toEqual(reply.body);
    });

    it('keeps the expired summary for good, and reports it in the list', async () => {
      const token = await place(A);
      await finishMenu(A);
      now = new Date('2027-06-01T00:00:00Z');
      expect((await call('GET', `/api/orders/${token}`)).body).toMatchObject({
        expired: { cookingDate: COOKING },
      });
      const list = parseCustomerOrdersResponse(
        (await call('GET', `/api/orders?tokens=${token}`)).body,
      );
      expect(list?.orders).toEqual([]);
      expect(list?.expired?.map((o) => o.token)).toEqual([token]);
    });

    it('still refuses change and cancel after expiry', async () => {
      const token = await place(A);
      await finishMenu(A);
      now = EXACTLY_28_DAYS;
      expect((await call('PATCH', `/api/orders/${token}`, { body: { note: 'x' } })).status).toBe(
        409,
      );
      expect((await call('POST', `/api/orders/${token}/cancel`)).body).toMatchObject({
        error: 'week_closed',
      });
    });

    it('answers 404 for a token that never existed', async () => {
      expect((await call('GET', '/api/orders/nope')).status).toBe(404);
      expect((await call('PATCH', '/api/orders/nope', { body: { note: 'x' } })).status).toBe(404);
    });

    it('forgets the expired summary after a dev reset', async () => {
      const token = await place(A);
      await finishMenu(A);
      now = EXACTLY_28_DAYS;
      await call('GET', `/api/orders/${token}`);
      await call('POST', '/api/dev/reset');
      expect((await call('GET', `/api/orders/${token}`)).status).toBe(404);
    });
  });

  describe('isolation between sellers', () => {
    it('shows the right seller on each archived order', async () => {
      const a = await place(A);
      const b = await place(B);
      await finishMenu(A);
      await finishMenu(B);
      const list = parseCustomerOrdersResponse(
        (await call('GET', `/api/orders?tokens=${a},${b}`)).body,
      );
      expect(list?.orders.map((o) => [o.token, o.seller.slug])).toEqual([
        [a, A],
        [b, B],
      ]);
    });

    it("does not let a seller see another seller's archive", async () => {
      const a = await place(A);
      await finishMenu(A);
      const weeksB = (await call('GET', '/api/seller/past-weeks', { seller: B })).body as {
        weeks: Array<unknown>;
      };
      expect(weeksB.weeks).toEqual([]);
      const weeksA = (await call('GET', '/api/seller/past-weeks', { seller: A })).body as {
        weeks: Array<{ id: string }>;
      };
      const id = weeksA.weeks[0]?.id ?? '';
      expect((await call('GET', `/api/seller/past-weeks/${id}`, { seller: B })).status).toBe(404);
      expect(a).toBeTruthy();
    });

    it('closing one seller does not archive the other seller orders', async () => {
      const a = await place(A);
      const b = await place(B);
      await finishMenu(A);
      const gotA = parseCustomerOrderResponse((await call('GET', `/api/orders/${a}`)).body);
      const gotB = parseCustomerOrderResponse((await call('GET', `/api/orders/${b}`)).body);
      expect(gotA?.order.archived).toBe(true);
      expect(gotB?.order.archived).toBeUndefined();
      expect(
        (await call('PATCH', `/api/orders/${b}`, { body: { note: 'still editable' } })).status,
      ).toBe(200);
    });
  });
});
