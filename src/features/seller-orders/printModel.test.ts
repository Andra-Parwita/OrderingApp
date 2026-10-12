import { describe, expect, it } from 'vitest';
import { buildPrintPlan, paginate, pickPrintOrders, PAGE_LINES } from './printModel';
import { makeMenuView, makeOrder } from './testSupport';

const view = makeMenuView('live');
const second = {
  id: 'p2',
  place: 'Brighton',
  directions: { en: '', id: '' },
  window: { start: '13:00', end: '14:00' },
};
const two = { ...view, pickupPoints: [...view.pickupPoints, second] };

const orders = [
  makeOrder({ id: '1', code: 'AAA222', pickupPlaceId: 'p1' }),
  makeOrder({ id: '2', code: 'BBB222', pickupPlaceId: 'p2', paid: true }),
  makeOrder({ id: '3', code: 'CCC222', fulfilment: 'delivery' }),
  makeOrder({ id: '4', code: 'DDD222', status: 'cancelled' }),
  makeOrder({ id: '5', code: 'EEE222', status: 'collected', collectedAt: '2026-10-17T01:00:00Z' }),
];

describe('print plan (plan 042)', () => {
  it('leaves cancelled orders out and groups by place, then delivery', () => {
    const plan = buildPrintPlan(orders, two, 'all', 'place', 'en');
    expect(plan.groups.map((g) => [g.key, g.orders.map((o) => o.code)])).toEqual([
      ['p1', ['AAA222', 'EEE222']],
      ['p2', ['BBB222']],
      ['delivery', ['CCC222']],
    ]);
    expect(plan.totals.orders).toBe(4);
    expect(plan.groups.flatMap((g) => g.orders).some((o) => o.status === 'cancelled')).toBe(false);
  });

  it('totals match the printed orders: dishes, money, paid and unpaid', () => {
    const { totals } = buildPrintPlan(orders, two, 'all', 'place', 'en');
    expect(totals.dishes).toEqual([{ itemId: 'lemper', name: 'Chicken lemper', qty: 8 }]);
    expect(totals.totalCents).toBe(8000);
    expect(totals.paidCents).toBe(2000);
    expect(totals.unpaidCents).toBe(6000);
  });

  it('not collected and not paid narrow the list', () => {
    expect(pickPrintOrders(orders, 'notCollected').map((o) => o.code)).toEqual([
      'AAA222',
      'BBB222',
      'CCC222',
    ]);
    expect(pickPrintOrders(orders, 'notPaid').map((o) => o.code)).toEqual([
      'AAA222',
      'CCC222',
      'EEE222',
    ]);
  });

  it('sort by code is one group in code order', () => {
    const plan = buildPrintPlan(orders, two, 'all', 'code', 'en');
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]?.orders.map((o) => o.code)).toEqual([
      'AAA222',
      'BBB222',
      'CCC222',
      'EEE222',
    ]);
  });

  it('paginates by budget, keeps every order once and ends with the totals', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeOrder({ id: `x${i}`, code: `A${String(i).padStart(2, '0')}222` }),
    );
    const pages = paginate(buildPrintPlan(many, view, 'all', 'place', 'en'), 'en');
    expect(pages.length).toBeGreaterThanOrEqual(2);
    const blocks = pages.flat();
    expect(blocks.filter((b) => b.type === 'order')).toHaveLength(30);
    expect(blocks.at(-1)?.type).toBe('totals');
    expect(PAGE_LINES).toBeGreaterThan(0);
  });

  it('50 dishes: every order once, totals right, the totals block on one page', () => {
    const lines = Array.from({ length: 50 }, (_, i) => ({
      itemId: `d${i}`,
      name: { en: `Dish number ${i}`, id: `Hidangan ${i}` },
      size: { en: '1', id: '1' },
      priceCents: 100,
      qty: 2,
    }));
    const big = Array.from({ length: 12 }, (_, i) =>
      makeOrder({ id: `b${i}`, code: `B${String(i).padStart(2, '0')}222`, lines }),
    );
    const plan = buildPrintPlan(big, view, 'all', 'place', 'en');
    expect(plan.totals.dishes).toHaveLength(50);
    expect(plan.totals.dishes.every((d) => d.qty === 24)).toBe(true);
    expect(plan.totals.totalCents).toBe(12 * 50 * 2 * 100);
    const pages = paginate(plan, 'en');
    expect(pages.flat().filter((b) => b.type === 'order')).toHaveLength(12);
    expect(pages.filter((p) => p.some((b) => b.type === 'totals'))).toHaveLength(1);
  });
});
