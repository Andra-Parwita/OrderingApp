import { describe, expect, it } from 'vitest';
import type { SellerMenuItemView, SellerOrder } from '../../../shared/domain';
import type { DaySaleEntry } from '../../../shared/daySalesContract';
import { summarise } from './daySummary';

const text = (s: string) => ({ en: s, id: s });
const item = (id: string, dayStock?: number): SellerMenuItemView => ({
  id,
  name: text(id),
  description: text(''),
  size: text(''),
  priceCents: 100,
  remaining: null,
  soldOut: false,
  ...(dayStock !== undefined ? { dayStock } : {}),
});
const order = (status: string, lines: Array<[string, number]>) =>
  ({
    status,
    lines: lines.map(([itemId, qty]) => ({ itemId, qty })),
  }) as unknown as SellerOrder;
const entry = (over: Partial<DaySaleEntry>): DaySaleEntry => ({
  id: Math.random().toString(),
  menuId: 'm',
  itemId: 'a',
  kind: 'sale',
  change: -1,
  stockAfter: 0,
  by: 'Olive',
  at: '2026-10-10T08:00:00.000Z',
  undone: false,
  ...over,
});

describe('summarise (plan 029 stage 5)', () => {
  it('counts pre-orders apart from day sales; undone sales and counts are not sales', () => {
    const result = summarise(
      [item('a', 3), item('b')],
      [
        order('ordered', [['a', 2]]),
        order('cancelled', [['a', 5]]),
        order('ready_for_pickup', [['a', 1]]),
      ],
      [
        entry({ change: -2, by: 'Olive' }),
        entry({ change: -1, by: 'Dewi' }),
        entry({ change: -4, by: 'Dewi', undone: true }),
        entry({ kind: 'undo', change: 4, by: 'Dewi' }),
        entry({ kind: 'count', change: 10, by: 'Olive' }),
      ],
    );
    expect(result.dishes).toEqual([{ itemId: 'a', preordered: 3, soldOnDay: 3, left: 3 }]);
    expect(result.totalSold).toBe(3);
    expect(result.people).toEqual([
      { name: 'Olive', portions: 2 },
      { name: 'Dewi', portions: 1 },
    ]);
  });
});
