import { describe, expect, it } from 'vitest';
import type { CustomerOrder } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { buildMyOrders } from './myOrdersModel';

const NOW = new Date('2026-10-17T02:00:00Z'); // Sat 17 Oct, noon in Melbourne

function order(patch: Partial<CustomerOrder>): CustomerOrder {
  return {
    id: 'o1',
    code: 'K7F2QX',
    token: 'tok-1',
    firstName: 'Dewi',
    language: 'en',
    lines: [
      {
        itemId: 'd1',
        name: { en: 'Rice', id: 'Nasi' },
        size: { en: '1 box', id: '1 kotak' },
        priceCents: 1500,
        qty: 2,
      },
    ],
    fulfilment: 'delivery',
    status: 'confirmed',
    locked: false,
    inbox: [],
    createdAt: '2026-10-14T09:00:00Z',
    updatedAt: '2026-10-14T09:00:00Z',
    seller: { slug: 'onde-onde', name: 'Onde Onde' },
    ...patch,
  } as CustomerOrder;
}

const menu = (cookingDate: string) =>
  ({ week: { cookingDate, pickupPoints: [] } }) as unknown as MenuResponse;

describe('buildMyOrders', () => {
  it('puts this week and later orders in Current, and a past or closed week in Earlier', () => {
    const rows = buildMyOrders({
      orders: [
        order({ token: 'a' }),
        order({ token: 'b', seller: { slug: 'rina', name: 'Dapur Bu Rina' } }),
        order({ token: 'c', archived: true, cookingDate: '2026-10-10', status: 'collected' }),
      ],
      expired: [],
      saved: [],
      menus: { 'onde-onde': menu('2026-10-17'), rina: menu('2026-10-10') },
      lang: 'en',
      now: NOW,
    });
    expect(rows.current.map((row) => row.token)).toEqual(['a']);
    expect(rows.earlier.map((row) => row.token)).toEqual(['b', 'c']);
    expect(rows.current[0]).toMatchObject({
      kitchen: 'Onde Onde',
      summary: '2 × Rice',
      dayText: 'Sat 17 Oct',
      totalCents: 3000,
    });
    expect(rows.earlier[1]).toMatchObject({ dayText: 'Sat 10 Oct', status: 'collected' });
  });

  it('adds archived entries last, with the code from this phone and no total', () => {
    const rows = buildMyOrders({
      orders: [],
      expired: [
        {
          archived: true,
          expired: true,
          token: 'x',
          seller: { slug: 'onde-onde', name: 'Onde Onde' },
          cookingDate: '2026-09-05',
        },
      ],
      saved: [{ code: 'J5R9KA', token: 'x', placedAt: '2026-09-01T00:00:00Z' }],
      menus: {},
      lang: 'id',
      now: NOW,
    });
    expect(rows.current).toHaveLength(0);
    expect(rows.earlier[0]).toMatchObject({
      code: 'J5R9KA',
      status: 'archived',
      totalCents: undefined,
    });
  });

  it('shows Paid only where it is known, and the unseen update', () => {
    const rows = buildMyOrders({
      orders: [
        order({
          token: 'a',
          inbox: [{ at: '2026-10-15T09:00:00Z', kind: 'message', textKey: 'ready' }],
        }),
        order({ token: 'b' }),
      ],
      expired: [],
      saved: [],
      menus: { 'onde-onde': menu('2026-10-17') },
      lang: 'en',
      paid: { a: true },
      now: NOW,
    });
    expect(rows.current.map((row) => [row.token, row.paid, row.unseen])).toEqual([
      ['a', true, true],
      ['b', undefined, false],
    ]);
  });
});
