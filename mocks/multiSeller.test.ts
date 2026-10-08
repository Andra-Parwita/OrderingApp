// Stage 5.1: many sellers in one mock. Seller A must never read or change seller B data (D-036).
import { beforeEach, describe, expect, it } from 'vitest';
import { parseDevSellersResponse } from '../shared/devContract';
import { parseMenuResponse, parseSellerMenuResponse } from '../shared/menuContract';
import {
  parseCustomerOrderResponse,
  parseCustomerOrdersResponse,
  parseSellerOrderResponse,
  parseSellerOrdersResponse,
} from '../shared/orderContract';
import { parseSettingsResponse } from '../shared/sellerContract';
import { handleMockRequest } from '../worker/mock/routes';
import { createStore, type MockStore } from '../worker/mock/store';

const A = 'onde-onde';
const B = 'dapur-demo';
const NOW = new Date('2026-10-07T10:00:00Z');
const SECRET = 'B secret note';

let store: MockStore;
let tokenCounter = 0;

type Reply = { status: number; body: unknown };

async function call(
  method: string,
  path: string,
  options: { seller?: string; body?: unknown } = {},
): Promise<Reply> {
  const headers: Record<string, string> = {};
  if (options.seller) headers['X-Seller'] = options.seller;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await handleMockRequest(
    store,
    new Request(`https://delave.test${path}`, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    }),
  );
  if (!response) return { status: -1, body: null };
  return { status: response.status, body: await response.json() };
}

const orderA = (extra = {}) => ({
  firstName: 'Rina',
  language: 'en',
  fulfilment: 'pickup',
  lines: [{ itemId: 'pesmol', qty: 1 }],
  ...extra,
});
const orderB = (extra = {}) => ({
  firstName: 'Tono',
  language: 'id',
  fulfilment: 'pickup',
  lines: [{ itemId: 'soto-ayam', qty: 2 }],
  ...extra,
});

function orderOf(reply: Reply) {
  const parsed = parseSellerOrderResponse(reply.body);
  if (!parsed) throw new Error(`not a seller order: ${JSON.stringify(reply.body)}`);
  return parsed.order;
}

async function place(slug: string, body: unknown) {
  const reply = await call('POST', `/api/s/${slug}/orders`, { body });
  const parsed = parseCustomerOrderResponse(reply.body);
  if (reply.status !== 201 || !parsed) throw new Error(JSON.stringify(reply));
  return parsed.order;
}

async function sellerOrders(seller: string) {
  const reply = await call('GET', '/api/seller/orders', { seller });
  return parseSellerOrdersResponse(reply.body)?.orders ?? [];
}

const newToken = () => `token-${String(++tokenCounter)}`;

beforeEach(() => {
  tokenCounter = 0;
  store = createStore({ now: () => NOW, newToken });
});

describe('sample sellers', () => {
  it('lists the two sellers for the dev picker', async () => {
    const reply = await call('GET', '/api/dev/sellers');
    const sellers = parseDevSellersResponse(reply.body)?.sellers;
    expect(sellers?.map((seller) => seller.slug)).toEqual([A, B]);
    expect(sellers?.[0]?.name).toBe('Onde Onde');
    expect(new Set(sellers?.map((seller) => seller.id)).size).toBe(2);
  });

  it('gives each seller its own menu, kitchen, chefs and settings', async () => {
    const a = parseMenuResponse((await call('GET', `/api/s/${A}/menu`)).body);
    const b = parseMenuResponse((await call('GET', `/api/s/${B}/menu`)).body);
    expect(a?.kitchen).toMatchObject({
      name: 'Onde Onde',
      tagline: { en: 'Indonesian homemade food', id: 'Masakan rumahan Indonesia' },
    });
    expect(a?.kitchen.images?.desktopBanner).toBe('/samples/banner-wide.jpg');
    expect(a?.items).toHaveLength(6);
    expect(b?.kitchen.name).toBe('Dapur Demo');
    expect(b?.kitchen.images).toBeUndefined();
    expect(b?.items.map((item) => item.id)).toEqual(['soto-ayam', 'martabak', 'es-teh']);
    expect(a?.seller.id).toBe(a?.kitchen.sellerId);
    expect(b?.seller.id).toBe(b?.kitchen.sellerId);
    expect(a?.seller.id).not.toBe(b?.seller.id);

    const sellerB = parseSellerMenuResponse(
      (await call('GET', '/api/seller/menu', { seller: B })).body,
    );
    expect(sellerB?.chefs).toEqual([{ id: 'rudi', sellerId: b?.seller.id, name: 'Chef Rudi' }]);
    const settingsA = parseSettingsResponse(
      (await call('GET', '/api/seller/settings', { seller: A })).body,
    );
    const settingsB = parseSettingsResponse(
      (await call('GET', '/api/seller/settings', { seller: B })).body,
    );
    expect(settingsA?.settings).not.toEqual(settingsB?.settings);
    expect(settingsB?.sellerId).toBe(b?.seller.id);
  });

  it('defaults a seller call without X-Seller to Onde Onde', async () => {
    const menu = parseSellerMenuResponse((await call('GET', '/api/seller/menu')).body);
    expect(menu?.seller.slug).toBe(A);
  });

  it('adds sample orders to the scoped seller only, with different tokens', async () => {
    const added = await call('POST', '/api/dev/sample-orders', { seller: B, body: { count: 5 } });
    expect(added.body).toEqual({ added: 5 });
    expect(await sellerOrders(A)).toEqual([]);
    await call('POST', '/api/dev/sample-orders', { seller: A, body: { count: 5 } });
    const a = await sellerOrders(A);
    const b = await sellerOrders(B);
    expect(a).toHaveLength(5);
    expect(b).toHaveLength(5);
    expect(a.every((order) => order.sellerId === store.seller(A)?.seller.id)).toBe(true);
    expect(b.every((order) => order.sellerId === store.seller(B)?.seller.id)).toBe(true);
    expect(new Set([...a, ...b].map((order) => order.token)).size).toBe(10);
    expect(new Set([...a, ...b].map((order) => order.id)).size).toBe(10);
  });
});

describe('unknown sellers and removed routes', () => {
  it('404s seller_not_found for an unknown slug', async () => {
    const expected = { status: 404, body: { error: 'seller_not_found' } };
    expect(await call('GET', '/api/s/nope/menu')).toMatchObject(expected);
    expect(await call('POST', '/api/s/nope/orders', { body: orderA() })).toMatchObject(expected);
    expect(await call('GET', '/api/seller/orders', { seller: 'nope' })).toMatchObject(expected);
    expect(await call('GET', '/api/seller/menu', { seller: 'Onde-Onde' })).toMatchObject(expected);
    expect(
      await call('POST', '/api/dev/sample-orders', { seller: 'nope', body: { count: 1 } }),
    ).toMatchObject(expected);
  });

  it('no longer serves the unscoped customer menu and order routes', async () => {
    expect((await call('GET', '/api/menu')).status).toBe(-1);
    expect((await call('POST', '/api/orders', { body: orderA() })).status).toBe(-1);
  });
});

describe('isolation: seller A cannot touch seller B', () => {
  let a: Awaited<ReturnType<typeof place>>;
  let b: Awaited<ReturnType<typeof place>>;

  describe('with the same 6-character code in both sellers', () => {
    beforeEach(async () => {
      store = createStore({ now: () => NOW, newToken, newCode: () => 'K7F2QX' });
      b = await place(B, orderB());
      a = await place(A, orderA());
    });

    it('does not clash, and each seller finds its own order by that code', async () => {
      expect(a.code).toBe(b.code);
      expect(a.token).not.toBe(b.token);
      const gotA = orderOf(await call('GET', `/api/seller/orders/${a.code}`, { seller: A }));
      const gotB = orderOf(await call('GET', `/api/seller/orders/${b.code}`, { seller: B }));
      expect(gotA.firstName).toBe('Rina');
      expect(gotB.firstName).toBe('Tono');
    });

    it('lands an action by code on the caller order only', async () => {
      const moved = await call('POST', `/api/seller/orders/${a.code}/status`, {
        seller: A,
        body: { to: 'confirmed' },
      });
      expect(orderOf(moved).firstName).toBe('Rina');
      const other = orderOf(await call('GET', `/api/seller/orders/${b.code}`, { seller: B }));
      expect(other.status).toBe('ordered');
    });
  });

  describe('with one order in B and none in A', () => {
    let code: string;

    beforeEach(async () => {
      b = await place(B, orderB({ note: SECRET }));
      code = b.code;
    });

    it('lists only its own orders', async () => {
      expect(await sellerOrders(A)).toEqual([]);
      await place(A, orderA());
      const listA = await sellerOrders(A);
      expect(listA.map((order) => order.firstName)).toEqual(['Rina']);
      expect(JSON.stringify(listA)).not.toContain(SECRET);
      expect((await sellerOrders(B)).map((order) => order.firstName)).toEqual(['Tono']);
    });

    it('cannot read, change, lock, nudge, mark paid, confirm or mark seen a B order', async () => {
      const notFound = { status: 404, body: { error: 'not_found' } };
      const as = { seller: A };
      const post = (action: string, body?: unknown) =>
        call('POST', `/api/seller/orders/${code}/${action}`, {
          ...as,
          ...(body !== undefined ? { body } : {}),
        });
      expect(await call('GET', `/api/seller/orders/${code}`, as)).toMatchObject(notFound);
      expect(await post('status', { to: 'confirmed' })).toMatchObject(notFound);
      expect(await post('paid', { paid: true })).toMatchObject(notFound);
      expect(await post('lock', { locked: true })).toMatchObject(notFound);
      expect(await post('wa-received', { received: true })).toMatchObject(notFound);
      expect(await post('nudge')).toMatchObject(notFound);
      expect(await post('seen')).toMatchObject(notFound);
      expect(await sellerOrders(A)).toEqual([]);

      const untouched = orderOf(await call('GET', `/api/seller/orders/${code}`, { seller: B }));
      expect(untouched).toMatchObject({
        status: 'ordered',
        paid: false,
        locked: false,
        waReceived: false,
      });
      expect(untouched.inbox).toHaveLength(1);
      expect(untouched.audit).toHaveLength(1);
    });

    it('cannot see B menu items, chefs or settings, and cannot change B settings', async () => {
      const menuA = parseSellerMenuResponse(
        (await call('GET', '/api/seller/menu', { seller: A })).body,
      );
      expect(menuA?.items.map((item) => item.id)).not.toContain('soto-ayam');
      expect(menuA?.chefs.map((chef) => chef.name)).toEqual(['Chef Wati']);
      expect(JSON.stringify(menuA)).not.toContain('Rudi');

      const before = await call('GET', '/api/seller/settings', { seller: B });
      const changed = {
        postGreeting: { en: 'A greeting', id: 'Salam A' },
        postClosing: { en: 'A closing', id: 'Penutup A' },
        orderingOpen: false,
      };
      const put = await call('PUT', '/api/seller/settings', { seller: A, body: changed });
      expect(parseSettingsResponse(put.body)?.settings.orderingOpen).toBe(false);
      expect(await call('GET', '/api/seller/settings', { seller: B })).toEqual(before);
      const publicB = parseMenuResponse((await call('GET', `/api/s/${B}/menu`)).body);
      expect(publicB?.ordering.open).toBe(true);
    });

    it('cannot order B items on A public route, and seller-entered orders stay in A', async () => {
      const wrong = await call('POST', `/api/s/${A}/orders`, { body: orderB() });
      expect(wrong).toMatchObject({ status: 400, body: { error: 'unknown_item' } });
      const entered = await call('POST', '/api/seller/orders', {
        seller: A,
        body: orderA({ firstName: 'Entered by A' }),
      });
      expect(orderOf(entered).sellerId).toBe(store.seller(A)?.seller.id);
      expect((await sellerOrders(B)).map((order) => order.firstName)).toEqual(['Tono']);
    });

    it('keeps portion limits per seller', async () => {
      await place(B, orderB({ lines: [{ itemId: 'martabak', qty: 6 }] }));
      const publicB = parseMenuResponse((await call('GET', `/api/s/${B}/menu`)).body);
      expect(publicB?.items.find((item) => item.id === 'martabak')).toMatchObject({
        remaining: 0,
        soldOut: true,
      });
      const publicA = parseMenuResponse((await call('GET', `/api/s/${A}/menu`)).body);
      expect(publicA?.items.find((item) => item.id === 'lemper')?.remaining).toBe(20);
    });

    it('lets a customer use the B token on the global endpoints, with B seller info', async () => {
      const got = parseCustomerOrderResponse((await call('GET', `/api/orders/${b.token}`)).body);
      expect(got?.order.seller).toEqual({ slug: B, name: 'Dapur Demo' });
      expect(got?.order).not.toHaveProperty('sellerId');
      expect(got?.order).not.toHaveProperty('audit');

      const patched = parseCustomerOrderResponse(
        (await call('PATCH', `/api/orders/${b.token}`, { body: { note: 'less spicy' } })).body,
      );
      expect(patched?.order).toMatchObject({ note: 'less spicy', seller: { slug: B } });

      const cancelled = parseCustomerOrderResponse(
        (await call('POST', `/api/orders/${b.token}/cancel`)).body,
      );
      expect(cancelled?.order).toMatchObject({ status: 'cancelled', seller: { slug: B } });
      expect((await sellerOrders(B))[0]?.status).toBe('cancelled');
    });
  });

  it('lists My orders across sellers, each with its seller', async () => {
    a = await place(A, orderA());
    b = await place(B, orderB());
    const reply = await call('GET', `/api/orders?tokens=${a.token},${b.token},unknown`);
    const orders = parseCustomerOrdersResponse(reply.body)?.orders ?? [];
    expect(orders.map((order) => [order.token, order.seller.slug])).toEqual([
      [a.token, A],
      [b.token, B],
    ]);
  });
});

describe('reset', () => {
  it('clears every seller', async () => {
    await place(A, orderA());
    await place(B, orderB());
    await call('POST', '/api/dev/reset');
    expect(await sellerOrders(A)).toEqual([]);
    expect(await sellerOrders(B)).toEqual([]);
  });
});
