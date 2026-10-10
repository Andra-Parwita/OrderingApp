import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import {
  addSampleOrders,
  cancelOrder,
  placeOrder,
  createSellerOrder,
  fetchMenu,
  fetchOrder,
  fetchSellerOrder,
  fetchSellerOrders,
  resetMock,
  setOrderPaid,
  setOrderStatus,
  updateOrder,
} from './client';
import type { CreateOrderRequest } from '../../shared/orderContract';
import type { ApiResult } from './http';
import { DEFAULT_SELLER_SLUG } from '../../shared/seller';

function data<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(`${result.error}: ${result.message}`);
  return result.data;
}

const base: CreateOrderRequest = {
  firstName: 'Rina',
  language: 'id',
  fulfilment: 'pickup',
  lines: [{ itemId: 'pesmol', qty: 1 }],
};

beforeEach(async () => {
  await mockStore.reset();
});

describe('customer endpoints', () => {
  it('loads the menu', async () => {
    const menu = data(await fetchMenu(DEFAULT_SELLER_SLUG));
    expect(menu.kitchen.name).toBe('Onde Onde');
    expect(menu.items).toHaveLength(6);
  });

  it('creates, loads, updates and cancels an order by token', async () => {
    const { order } = data(await placeOrder(DEFAULT_SELLER_SLUG, base));
    expect(order.status).toBe('ordered');
    expect(data(await fetchOrder(order.token)).order.id).toBe(order.id);
    const updated = data(await updateOrder(order.token, { note: 'less salt' }));
    expect(updated.order.note).toBe('less salt');
    expect(data(await cancelOrder(order.token)).order.status).toBe('cancelled');
  });

  it('returns typed API errors', async () => {
    expect(await fetchOrder('unknown')).toMatchObject({
      ok: false,
      error: 'not_found',
      status: 404,
    });
    expect(
      await placeOrder(DEFAULT_SELLER_SLUG, { ...base, lines: [{ itemId: 'nope', qty: 1 }] }),
    ).toMatchObject({
      ok: false,
      error: 'unknown_item',
    });
    expect(
      await placeOrder(DEFAULT_SELLER_SLUG, { ...base, lines: [{ itemId: 'lemper', qty: 21 }] }),
    ).toMatchObject({
      ok: false,
      error: 'exceeds_remaining',
      status: 409,
    });
  });

  it('rejects an invalid body with invalid_request', async () => {
    expect(await placeOrder(DEFAULT_SELLER_SLUG, { ...base, firstName: '' })).toMatchObject({
      ok: false,
      error: 'invalid_request',
      status: 400,
    });
  });
});

describe('seller endpoints', () => {
  it('lists, gets (forgiving code), enters, moves status and marks paid', async () => {
    const actor = { role: 'chef', name: 'Wati' } as const;
    const entered = data(await createSellerOrder(base, actor)).order;
    expect(entered).toMatchObject({ status: 'confirmed', enteredBy: actor });
    const typed = `${entered.code.slice(0, 3)} ${entered.code.slice(3)}`.toLowerCase();
    expect(data(await fetchSellerOrder(typed)).order.id).toBe(entered.id);
    expect(data(await fetchSellerOrders()).orders).toHaveLength(1);

    const moved = data(await setOrderStatus(entered.code, 'ready_for_pickup', actor)).order;
    expect(moved.status).toBe('ready_for_pickup');
    expect(moved.audit[0]?.by).toEqual(actor);
    expect(data(await setOrderPaid(entered.code, true)).order.paid).toBe(true);
    // no X-Actor header: the default seller
    expect(data(await fetchSellerOrder(entered.code)).order.audit[0]?.by).toEqual({
      role: 'seller',
      name: 'Bu Ani',
    });
  });

  it('refuses a status outside nextStatuses and an unknown code', async () => {
    const { order } = data(await placeOrder(DEFAULT_SELLER_SLUG, base));
    expect(await setOrderStatus(order.code, 'delivered')).toMatchObject({
      ok: false,
      error: 'invalid_status',
    });
    expect(await fetchSellerOrder('ZZZZZZ')).toMatchObject({ ok: false, error: 'not_found' });
  });
});

describe('dev endpoints and failures', () => {
  it('adds sample orders and resets', async () => {
    expect(data(await addSampleOrders(5))).toEqual({ added: 5 });
    expect(data(await fetchSellerOrders()).orders).toHaveLength(5);
    expect(data(await resetMock())).toEqual({ ok: true });
    expect(data(await fetchSellerOrders()).orders).toHaveLength(0);
    expect(await addSampleOrders(0)).toMatchObject({ ok: false, error: 'invalid_request' });
  });

  it('reports a body that does not match the contract', async () => {
    server.use(http.get('*/api/s/onde-onde/menu', () => HttpResponse.json({ nonsense: true })));
    expect(await fetchMenu(DEFAULT_SELLER_SLUG)).toMatchObject({
      ok: false,
      error: 'bad_response',
    });
  });

  it('reports a network error', async () => {
    server.use(http.get('*/api/s/onde-onde/menu', () => HttpResponse.error()));
    expect(await fetchMenu(DEFAULT_SELLER_SLUG)).toMatchObject({
      ok: false,
      error: 'network',
      status: 0,
    });
  });
});
