// @vitest-environment node
// Stage 8.4b: two orders for the last portion, placed in the same instant, must not both succeed.
// The limit check is part of the same D1 batch as the writes (worker/db/seller.ts, portionGuard).
// Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateOrderRequest } from '../shared/orderContract';
import { useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');

function order(firstName: string, qty: number): CreateOrderRequest {
  return {
    firstName,
    language: 'en',
    fulfilment: 'pickup',
    lines: [{ itemId: 'pesmol', qty }],
  };
}

describe('portion limit under concurrent orders', () => {
  const create = useWorld('portion-race');
  let world: World;
  let n = 0;

  const seller = async () => {
    const handle = await world.repo.sellerBySlug('onde-onde');
    if (!handle) throw new Error('no seller');
    return handle;
  };
  const used = async () =>
    (
      await world.db.first<{ n: number }>(
        `SELECT COALESCE(SUM(l.qty), 0) AS n FROM order_lines l JOIN orders o
         ON o.seller_id = l.seller_id AND o.id = l.order_id
         WHERE l.item_id = 'pesmol' AND o.status <> 'cancelled'`,
      )
    )?.n;
  const setLimit = (limit: number) =>
    world.db.stmt("UPDATE menu_items SET portion_limit = ? WHERE id = 'pesmol'", limit).run();

  beforeEach(async () => {
    world = await create({
      now: () => NOW,
      newToken: () => `token-${String(++n)}-padding-padding`,
    });
  });

  it('lets exactly one of two orders for the last portion through', async () => {
    await setLimit(1);
    const onde = await seller();
    const results = await Promise.all([
      onde.createOrder(order('Rina', 1)),
      onde.createOrder(order('Tom', 1)),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const lost = results.find((r) => !r.ok);
    expect(lost && !lost.ok && lost.error).toBe('sold_out');
    expect(await used()).toBe(1);
    expect(await world.db.first('SELECT COUNT(*) AS n FROM orders')).toEqual({ n: 1 });
  });

  it('gives the loser the same "only N left" error a slower order would get', async () => {
    await setLimit(3);
    const onde = await seller();
    const results = await Promise.all([
      onde.createOrder(order('Rina', 2)),
      onde.createOrder(order('Tom', 2)),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const lost = results.find((r) => !r.ok);
    expect(lost && !lost.ok && lost.error).toBe('exceeds_remaining');
    expect(await used()).toBe(2);
  });

  it('holds for a customer edit that raises a quantity at the same moment', async () => {
    await setLimit(3);
    const onde = await seller();
    const first = await onde.createOrder(order('Rina', 1));
    const second = await onde.createOrder(order('Tom', 1));
    if (!first.ok || !second.ok) throw new Error('setup failed');
    const raise = { lines: [{ itemId: 'pesmol', qty: 2 }] };
    const results = await Promise.all([
      onde.updateOrder(first.value.token, raise),
      onde.updateOrder(second.value.token, raise),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await used()).toBe(3);
  });

  it('still takes many orders one after another up to the limit', async () => {
    await setLimit(3);
    const onde = await seller();
    const results = [];
    for (const name of ['A', 'B', 'C', 'D']) results.push(await onde.createOrder(order(name, 1)));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
  });
});
