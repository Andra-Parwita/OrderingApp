import { describe, expect, it } from 'vitest';
import type { Order, OrderStatus } from '../../../shared/domain';
import { selectCounts, selectOrderByCode, visibleOrders } from './sellerOrdersSelectors';
import { ordersLoaded, sellerOrdersReducer, type SellerOrdersRootState } from './sellerOrdersSlice';
import { parseStatusFilter, type StatusFilter } from './orderStatus';
import { makeOrder } from './testSupport';

function order(id: string, code: string, firstName: string, status: OrderStatus): Order {
  return makeOrder({ id, code, firstName, status });
}

const ORDERS: Array<Order> = [
  order('1', 'K7F2QX', 'Rina', 'confirmed'),
  order('2', 'M3H9TD', 'Tom', 'ordered'),
  order('3', 'R8P4WB', 'Sari', 'ready_for_pickup'),
  order('4', 'T2N6KC', 'Budi', 'out_for_delivery'),
  order('5', 'W5J3MZ', 'Mei', 'collected'),
  order('6', 'H9D7RV', 'Dewi', 'delivered'),
  order('7', 'B4X8GA', 'Arif', 'cancelled'),
];

function stateWith(...actions: Array<ReturnType<typeof ordersLoaded>>): SellerOrdersRootState {
  let sellerOrders = sellerOrdersReducer(undefined, { type: 'init' });
  for (const action of actions) sellerOrders = sellerOrdersReducer(sellerOrders, action);
  return { sellerOrders };
}

describe('selectCounts', () => {
  it('counts per tab, grouping the ready and done statuses', () => {
    expect(selectCounts(stateWith(ordersLoaded({ orders: ORDERS })))).toEqual({
      all: 7,
      ordered: 1,
      confirmed: 1,
      ready: 2,
      done: 2,
      cancelled: 1,
    });
  });

  it('is memoised: the same orders give the same object', () => {
    const state = stateWith(ordersLoaded({ orders: ORDERS }));
    expect(selectCounts(state)).toBe(selectCounts(state));
  });
});

describe('visibleOrders', () => {
  it('shows everything on All with no search', () => {
    expect(visibleOrders(ORDERS, 'all', '')).toHaveLength(7);
  });

  it('filters by tab', () => {
    const names = (filter: StatusFilter) =>
      visibleOrders(ORDERS, filter, '').map((o) => o.firstName);
    expect(names('ordered')).toEqual(['Tom']);
    expect(names('ready')).toEqual(['Sari', 'Budi']);
    expect(names('done')).toEqual(['Mei', 'Dewi']);
    expect(names('cancelled')).toEqual(['Arif']);
  });

  it('finds an order by a forgivingly typed code', () => {
    for (const typed of ['k7f2qx', 'K7F 2QX', 'K7F-2QX']) {
      const result = visibleOrders(ORDERS, 'all', typed);
      expect(result.map((o) => o.code)).toEqual(['K7F2QX']);
    }
  });

  it('finds an order by part of a first name, ignoring case', () => {
    expect(visibleOrders(ORDERS, 'all', 'sa').map((o) => o.firstName)).toEqual(['Sari']);
  });

  it('combines the tab and the search', () => {
    expect(visibleOrders(ORDERS, 'ordered', 'rina')).toEqual([]);
  });
});

describe('parseStatusFilter', () => {
  it('accepts the known filters and treats anything else as All', () => {
    expect(parseStatusFilter('ready')).toBe('ready');
    expect(parseStatusFilter('bogus')).toBe('all');
    expect(parseStatusFilter(null)).toBe('all');
  });
});

describe('selectOrderByCode', () => {
  it('accepts the raw or the displayed code', () => {
    const state = stateWith(ordersLoaded({ orders: ORDERS }));
    expect(selectOrderByCode(state, 'K7F2QX')?.firstName).toBe('Rina');
    expect(selectOrderByCode(state, 'k7f-2qx')?.firstName).toBe('Rina');
    expect(selectOrderByCode(state, 'AAAAAA')).toBeUndefined();
  });
});

describe('ordersLoaded', () => {
  it('keeps the old object when an order did not change', () => {
    const first = stateWith(ordersLoaded({ orders: ORDERS }));
    const before = first.sellerOrders.orders[0];
    const again = sellerOrdersReducer(
      first.sellerOrders,
      ordersLoaded({ orders: structuredClone(ORDERS) }),
    );
    expect(again.orders[0]).toBe(before);
  });
});
