import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../mocks/handlers';
import type { CreateOrderRequest } from '../../shared/orderContract';
import {
  placeOrder,
  createSellerOrder,
  fetchMenu,
  fetchSellerMenu,
  fetchMyOrders,
  fetchOrder,
  fetchSellerOrder,
  fetchSettings,
  markOrderSeen,
  nudgeOrder,
  saveSettings,
  setOrderLocked,
  setOrderWaReceived,
  updateOrder,
} from './client';
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

describe('menu chef data (D-012)', () => {
  it('never puts chef data in the public menu, at the raw text level', async () => {
    const raw = await (await fetch('/api/s/onde-onde/menu')).text();
    expect(raw.toLowerCase()).not.toContain('chef');
    expect(data(await fetchMenu(DEFAULT_SELLER_SLUG)).items).toHaveLength(6);
  });

  it('gives the seller menu the chefs and chef ids', async () => {
    const menu = data(await fetchSellerMenu());
    expect(menu.chefs).toEqual([{ id: 'wati', sellerId: 'seller-onde-onde', name: 'Chef Wati' }]);
    expect(menu.items.find((item) => item.id === 'lemper')?.chefId).toBe('wati');
    expect(await (await fetch('/api/seller/menu')).text()).toContain('Chef Wati');
  });
});

describe('batch 2 endpoints', () => {
  it('returns the customer view without seller-only fields', async () => {
    const { order } = data(await placeOrder(DEFAULT_SELLER_SLUG, { ...base, returning: true }));
    for (const key of ['audit', 'waReceived', 'returning', 'enteredBy', 'changed']) {
      expect(order).not.toHaveProperty(key);
    }
    // `paid` is the one money fact the customer sees (the Paid pill, plan 004 stage 6).
    expect(order).toMatchObject({ locked: false, status: 'ordered', paid: false });
    expect(order.inbox).toHaveLength(1);
    const raw = (await (await fetch(`/api/orders/${order.token}`)).json()) as {
      order: Record<string, unknown>;
    };
    expect(Object.keys(raw.order)).not.toContain('audit');
    expect(data(await fetchSellerOrder(order.code)).order.returning).toBe(true);
  });

  it('locks, ticks WhatsApp, nudges and marks seen', async () => {
    const { order } = data(await placeOrder(DEFAULT_SELLER_SLUG, base));
    expect(data(await setOrderLocked(order.code, true)).order.locked).toBe(true);
    const refused = await updateOrder(order.token, { note: 'x' });
    expect(refused).toMatchObject({ ok: false, error: 'order_locked', status: 409 });
    expect(data(await setOrderWaReceived(order.code, true)).order.waReceived).toBe(true);
    expect(data(await nudgeOrder(order.code)).order.inbox[0]).toMatchObject({
      kind: 'nudge',
      textKey: 'nudge',
    });
    expect(data(await fetchOrder(order.token)).order.inbox[0]?.kind).toBe('nudge');
    expect(data(await markOrderSeen(order.code)).order.changed).toBe(false);
  });

  it('enters a seller order with confirmNow and paid', async () => {
    const { order } = data(await createSellerOrder({ ...base, confirmNow: false, paid: true }));
    expect(order).toMatchObject({ status: 'ordered', paid: true });
  });

  it('reads and saves settings, normalising the number', async () => {
    const settings = data(await fetchSettings()).settings;
    expect(settings.orderingOpen).toBe(true);
    const saved = data(await saveSettings({ ...settings, whatsappNumber: '0412 345 678' }));
    expect(saved.settings.whatsappNumber).toBe('61412345678');
    const menu = data(await fetchMenu(DEFAULT_SELLER_SLUG));
    expect(menu.kitchen.whatsappNumber).toBe('61412345678');
    expect(menu.ordering).toEqual({ open: true });
    const bad = await saveSettings({ ...settings, whatsappNumber: 'nope' });
    expect(bad).toMatchObject({ ok: false, error: 'invalid_request' });
    data(await saveSettings({ ...settings, orderingOpen: false }));
    expect(data(await fetchMenu(DEFAULT_SELLER_SLUG)).ordering.reason).toBe('closed_by_seller');
    expect(await placeOrder(DEFAULT_SELLER_SLUG, base)).toMatchObject({
      ok: false,
      error: 'ordering_closed',
    });
  });

  it('loads My orders by tokens, omitting unknown ones, max 20', async () => {
    const a = data(await placeOrder(DEFAULT_SELLER_SLUG, base)).order;
    const b = data(await placeOrder(DEFAULT_SELLER_SLUG, base)).order;
    const mine = data(await fetchMyOrders([b.token, 'unknown', a.token]));
    expect(mine.orders.map((order) => order.id)).toEqual([b.id, a.id]);
    expect(mine.orders[0]).not.toHaveProperty('audit');
    expect(data(await fetchMyOrders([])).orders).toEqual([]);
    const many = Array.from({ length: 21 }, (_, n) => `t${String(n)}`);
    expect(await fetchMyOrders(many)).toMatchObject({ ok: false, error: 'invalid_request' });
    expect(data(await fetchMyOrders(many.slice(0, 20))).orders).toEqual([]);
  });
});
