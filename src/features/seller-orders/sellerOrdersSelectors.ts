import { createSelector } from '@reduxjs/toolkit';
import type { Order } from '../../../shared/domain';
import { parseOrderCode } from '../../../shared/orderCode';
import { filterOf, type StatusFilter } from './orderStatus';
import type { SellerOrdersRootState } from './sellerOrdersSlice';

export type StatusCounts = Readonly<Record<StatusFilter, number>>;

export const selectOrders = (state: SellerOrdersRootState) => state.sellerOrders.orders;
export const selectList = (state: SellerOrdersRootState) => state.sellerOrders.list;
export const selectChange = (state: SellerOrdersRootState) => state.sellerOrders.change;
export const selectCookingDate = (state: SellerOrdersRootState) => state.sellerOrders.cookingDate;

export const selectCounts = createSelector([selectOrders], (orders): StatusCounts => {
  const counts: Record<StatusFilter, number> = {
    all: orders.length,
    ordered: 0,
    confirmed: 0,
    ready: 0,
    done: 0,
    cancelled: 0,
  };
  for (const order of orders) counts[filterOf(order.status)] += 1;
  return counts;
});

/** Forgiving: a full code in any spelling, or part of a first name. */
export function matchesQuery(order: Order, query: string): boolean {
  const text = query.trim();
  if (text === '') return true;
  const code = parseOrderCode(text);
  if (code !== null && order.code === code) return true;
  return order.firstName.toLowerCase().includes(text.toLowerCase());
}

/** The list for a filter tab and a search text (both come from the URL). */
export function visibleOrders(
  orders: ReadonlyArray<Order>,
  filter: StatusFilter,
  query: string,
): Array<Order> {
  return orders.filter(
    (order) =>
      (filter === 'all' || filterOf(order.status) === filter) && matchesQuery(order, query),
  );
}

export function selectOrderByCode(state: SellerOrdersRootState, code: string): Order | undefined {
  const raw = parseOrderCode(code) ?? code;
  return state.sellerOrders.orders.find((order) => order.code === raw);
}
