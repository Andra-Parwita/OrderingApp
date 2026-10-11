import { describe, expect, it } from 'vitest';
import type { Order } from '../../../shared/domain';
import type { MenuView } from '../../../shared/menusContract';
import { cookingProgress, isRunningNow, liveNumbers, placeLoads, timeLeft } from './liveData';

function order(over: Partial<Order>): Order {
  return {
    id: 'o',
    status: 'ordered',
    paid: false,
    changed: false,
    fulfilment: 'pickup',
    lines: [{ itemId: 'a', priceCents: 500, qty: 2 }],
    ...over,
  } as Order;
}
const VIEW = {
  menu: { delivery: { available: false, note: { en: '', id: '' } } },
  dishes: [],
  pickupPoints: [
    { id: 'p1', place: 'Glenelg', window: { start: '10:00', end: '12:00' } },
    { id: 'p2', place: 'Clayton', window: { start: '11:00', end: '13:00' } },
  ],
} as unknown as MenuView;

describe('live Home numbers', () => {
  it('counts cancelled orders apart and leaves them out of every sum', () => {
    const n = liveNumbers([
      order({ paid: true }),
      order({ changed: true }),
      order({ status: 'cancelled' }),
    ]);
    expect(n).toMatchObject({ orders: 2, cancelled: 1, totalCents: 2000, paidCents: 1000 });
    expect(n).toMatchObject({ toConfirm: 2, changed: 1, unpaidCount: 1, unpaidCents: 1000 });
  });

  it('puts an order without a place at the first place, and adds delivery only when it has orders or is on', () => {
    const loads = placeLoads(VIEW, [
      order({}),
      order({ pickupPlaceId: 'p2', collectedAt: '2026-10-17T00:00:00Z', packed: true }),
    ]);
    expect(loads.map((l) => [l.name, l.orders, l.packed, l.handedOver])).toEqual([
      ['Glenelg', 1, 0, 0],
      ['Clayton', 1, 1, 1],
    ]);
    const withDelivery = placeLoads(VIEW, [order({ fulfilment: 'delivery', status: 'delivered' })]);
    expect(withDelivery.at(-1)).toMatchObject({ kind: 'delivery', orders: 1, handedOver: 1 });
  });

  it('works out the three bars', () => {
    const bars = cookingProgress([
      order({ packed: true, collectedAt: 'x' }),
      order({}),
      order({ fulfilment: 'delivery', status: 'delivered' }),
    ]);
    expect(bars).toEqual({
      packed: { done: 1, of: 3 },
      collected: { done: 1, of: 2 },
      delivered: { done: 1, of: 1 },
    });
  });
});

describe('time', () => {
  it('knows a pickup that is running in Melbourne time, on the cooking day only', () => {
    const window = { start: '10:00', end: '12:00' };
    const at = (iso: string) => isRunningNow(window, '2026-10-17', new Date(iso));
    expect(at('2026-10-16T23:30:00Z')).toBe(true); // 10:30 on the 17th
    expect(at('2026-10-17T01:00:00Z')).toBe(false); // 12:00 sharp: over
    expect(at('2026-10-16T22:59:00Z')).toBe(false); // 09:59
    expect(isRunningNow(window, '2026-10-24', new Date('2026-10-22T23:30:00Z'))).toBe(false);
  });

  it('says how long is left: days and hours, hours and minutes, minutes', () => {
    const cutoff = '2026-10-15T20:00:00+11:00';
    expect(timeLeft(cutoff, new Date('2026-10-14T01:00:00Z'))).toEqual({
      kind: 'dh',
      days: 1,
      hours: 8,
    });
    expect(timeLeft(cutoff, new Date('2026-10-15T05:30:00Z'))).toEqual({
      kind: 'hm',
      hours: 3,
      minutes: 30,
    });
    expect(timeLeft(cutoff, new Date('2026-10-15T08:45:00Z'))).toEqual({ kind: 'm', minutes: 15 });
  });
});
