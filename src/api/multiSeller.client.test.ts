import { beforeEach, describe, expect, it } from 'vitest';
import { mockStores } from '../../mocks/handlers';
import type { CreateOrderRequest } from '../../shared/orderContract';
import {
  addSampleOrders,
  fetchDevSellers,
  fetchMenu,
  fetchMyOrders,
  fetchOrder,
  fetchSellerMenu,
  fetchSellerOrder,
  fetchSellerOrders,
  placeOrder,
  setOrderStatus,
} from './client';
import type { ApiResult } from './http';

function data<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(`${result.error}: ${result.message}`);
  return result.data;
}

const demoOrder: CreateOrderRequest = {
  firstName: 'Tono',
  language: 'id',
  fulfilment: 'pickup',
  lines: [{ itemId: 'soto-ayam', qty: 1 }],
};

beforeEach(() => {
  mockStores.reset();
});

describe('multi-seller client', () => {
  it('loads each seller menu by slug and 404s an unknown slug', async () => {
    expect(data(await fetchMenu('onde-onde')).kitchen.name).toBe('Onde Onde');
    expect(data(await fetchMenu('dapur-demo')).kitchen.name).toBe('Dapur Demo');
    expect(await fetchMenu('nope')).toMatchObject({
      ok: false,
      status: 404,
      error: 'seller_not_found',
    });
  });

  it('places an order at a slug; the order knows its seller on the global endpoints', async () => {
    const { order } = data(await placeOrder('dapur-demo', demoOrder));
    expect(order.seller).toEqual({ slug: 'dapur-demo', name: 'Dapur Demo' });
    expect(data(await fetchOrder(order.token)).order.seller.slug).toBe('dapur-demo');
    expect(data(await fetchMyOrders([order.token])).orders).toHaveLength(1);
    expect(await placeOrder('onde-onde', demoOrder)).toMatchObject({
      ok: false,
      error: 'unknown_item',
    });
  });

  it('scopes seller calls with the seller argument', async () => {
    const { order } = data(await placeOrder('dapur-demo', demoOrder));
    expect(data(await fetchSellerOrders(undefined, 'dapur-demo')).orders).toHaveLength(1);
    expect(data(await fetchSellerOrders()).orders).toHaveLength(0);
    expect(data(await fetchSellerOrders(undefined, 'onde-onde')).orders).toHaveLength(0);
    expect(await fetchSellerOrder(order.code, undefined, 'onde-onde')).toMatchObject({
      ok: false,
      status: 404,
      error: 'not_found',
    });
    expect(await setOrderStatus(order.code, 'confirmed', undefined, 'onde-onde')).toMatchObject({
      ok: false,
      error: 'not_found',
    });
    expect(
      data(await setOrderStatus(order.code, 'confirmed', undefined, 'dapur-demo')).order.status,
    ).toBe('confirmed');
    expect(data(await fetchSellerMenu(undefined, 'dapur-demo')).chefs[0]?.name).toBe('Chef Rudi');
    expect(await fetchSellerOrders(undefined, 'nope')).toMatchObject({
      ok: false,
      error: 'seller_not_found',
    });
  });

  it('adds sample orders to one seller and lists the sellers', async () => {
    expect(data(await addSampleOrders(3, 'dapur-demo')).added).toBe(3);
    expect(data(await fetchSellerOrders(undefined, 'dapur-demo')).orders).toHaveLength(3);
    expect(data(await fetchSellerOrders(undefined, 'onde-onde')).orders).toHaveLength(0);
    expect(data(await fetchDevSellers()).sellers.map((seller) => seller.slug)).toEqual([
      'onde-onde',
      'dapur-demo',
    ]);
  });
});
