import { describe, expect, it } from 'vitest';
import type { PickupPoint } from '../../../shared/domain';
import { bagsOf, nextUnpacked, sortBags, toggledIds, withTicks } from './packModel';
import { line, makeOrder } from './testSupport';

const POINTS: Array<PickupPoint> = [
  {
    id: 'p1',
    place: 'Glenelg',
    directions: { en: '', id: '' },
    window: { start: '11:00', end: '12:00' },
  },
  {
    id: 'p2',
    place: 'Clayton',
    directions: { en: '', id: '' },
    window: { start: '10:00', end: '11:00' },
  },
];

const orders = [
  makeOrder({ id: 'a', code: 'AAAAAA', pickupPlaceId: 'p1', lines: [line('nasi', 1)] }),
  makeOrder({ id: 'b', code: 'BBBBBB', pickupPlaceId: 'p2', lines: [line('nasi', 1)] }),
  makeOrder({ id: 'c', code: 'CCCCCC', fulfilment: 'delivery', lines: [line('nasi', 1)] }),
  makeOrder({ id: 'd', code: 'DDDDDD', status: 'cancelled', lines: [line('nasi', 1)] }),
];

describe('packModel', () => {
  it('leaves out cancelled orders and counts ticks', () => {
    const bags = bagsOf(
      [makeOrder({ lines: [{ ...line('nasi', 1), ticked: true }, line('tempe', 1)] }), orders[3]!],
      POINTS,
    );
    expect(bags).toHaveLength(1);
    expect(bags[0]).toMatchObject({ ticked: 1, total: 2, packed: false });
  });

  it('sorts by pickup time with deliveries last, by place and by code', () => {
    const bags = bagsOf(orders, POINTS);
    expect(sortBags(bags, 'time').map((bag) => bag.order.id)).toEqual(['b', 'a', 'c']);
    expect(sortBags(bags, 'place').map((bag) => bag.order.id)).toEqual(['b', 'a', 'c']);
    expect(sortBags(bags, 'code').map((bag) => bag.order.id)).toEqual(['a', 'b', 'c']);
  });

  it('finds the next unpacked bag, wrapping round', () => {
    const bags = bagsOf([{ ...orders[0]!, packed: true }, orders[1]!, orders[2]!], POINTS);
    expect(nextUnpacked(bags, 'CCCCCC')?.order.id).toBe('b');
    expect(nextUnpacked(bagsOf([{ ...orders[0]!, packed: true }], POINTS), 'AAAAAA')).toBeNull();
  });

  it('flips one tick in the whole set', () => {
    const order = makeOrder({ lines: [{ ...line('nasi', 1), ticked: true }, line('tempe', 1)] });
    expect(toggledIds(order, 'tempe').sort()).toEqual(['nasi', 'tempe']);
    expect(toggledIds(order, 'nasi')).toEqual([]);
    expect(withTicks(order, ['tempe']).lines.map((l) => l.ticked)).toEqual([undefined, true]);
  });
});
