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
    changed: 0,
    confirmed: 0,
    ready: 0,
    done: 0,
    cancelled: 0,
  };
  for (const order of orders) {
    counts[filterOf(order.status)] += 1;
    if (order.changed) counts.changed += 1;
  }
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

function matchesFilter(order: Order, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'changed') return order.changed;
  return filterOf(order.status) === filter;
}

/** An order the seller is still owed money for (cancelled orders are not owed). */
export function isUnpaid(order: Order): boolean {
  return !order.paid && order.status !== 'cancelled';
}

/** The two toggles beside the tabs: Changed and Not paid (they narrow the tab's list). */
export type ListToggles = Readonly<{ changed?: boolean; unpaid?: boolean }>;

/** The list for a filter tab, a search text and the toggles (all come from the URL). */
export function visibleOrders(
  orders: ReadonlyArray<Order>,
  filter: StatusFilter,
  query: string,
  toggles: ListToggles = {},
): Array<Order> {
  return orders.filter(
    (order) =>
      matchesFilter(order, filter) &&
      matchesQuery(order, query) &&
      (!toggles.changed || order.changed) &&
      (!toggles.unpaid || isUnpaid(order)),
  );
}

export const selectUnpaidCount = createSelector(
  [selectOrders],
  (orders) => orders.filter(isUnpaid).length,
);

export const selectCurrent = (state: SellerOrdersRootState) => state.sellerOrders.current;
export const selectPast = (state: SellerOrdersRootState) => state.sellerOrders.past;
export const selectWarned = (state: SellerOrdersRootState) => state.sellerOrders.warned;
export const selectToast = (state: SellerOrdersRootState) => state.sellerOrders.toast;
export const selectDevSampling = (state: SellerOrdersRootState) => state.sellerOrders.devSampling;

/** Portions sold per menu item id (not cancelled), for the live Dishes panel. */
export const selectSoldByItem = createSelector([selectOrders], (orders) => {
  const sold = new Map<string, number>();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    for (const line of order.lines) sold.set(line.itemId, (sold.get(line.itemId) ?? 0) + line.qty);
  }
  return sold;
});

export function selectOrderByCode(state: SellerOrdersRootState, code: string): Order | undefined {
  const raw = parseOrderCode(code) ?? code;
  return state.sellerOrders.orders.find((order) => order.code === raw);
}

export const selectMenu = (state: SellerOrdersRootState) => state.sellerOrders.menu;
export const selectCreate = (state: SellerOrdersRootState) => state.sellerOrders.create;
export const selectNotice = (state: SellerOrdersRootState) => state.sellerOrders.notice;

/** The order before and after `code` in the given list (the filtered, searched table). */
export function neighbourCodes(
  orders: ReadonlyArray<Order>,
  code: string,
): Readonly<{ previous: string | null; next: string | null }> {
  const raw = parseOrderCode(code) ?? code;
  const index = orders.findIndex((order) => order.code === raw);
  // Not in the list any more (the filter changed): Next starts from the top.
  return {
    previous: orders[index - 1]?.code ?? null,
    next: orders[index + 1]?.code ?? null,
  };
}

/** How many orders the live menu has, for the nav; null until the first load. */
export const selectOrdersCount = (state: SellerOrdersRootState): number | null =>
  state.sellerOrders.list.status === 'ready' ? state.sellerOrders.orders.length : null;
