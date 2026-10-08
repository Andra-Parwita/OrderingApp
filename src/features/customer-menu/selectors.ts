import { createSelector } from '@reduxjs/toolkit';
import type { MenuItemView } from '../../../shared/domain';
import type { CustomerRootState } from './customerSlice';

export type BasketLine = Readonly<{ item: MenuItemView; qty: number; lineCents: number }>;

const EMPTY_LINES: ReadonlyArray<BasketLine> = [];

export const selectMenu = (state: CustomerRootState) => state.customer.menu;
export const selectBasket = (state: CustomerRootState) => state.customer.basket;
export const selectPlace = (state: CustomerRootState) => state.customer.place;
export const selectOrder = (state: CustomerRootState) => state.customer.order;

/** Basket lines in menu order; items no longer on the menu are left out. */
export const selectBasketLines = createSelector([selectMenu, selectBasket], (menu, basket) => {
  if (menu.status !== 'ready') return EMPTY_LINES;
  const lines: Array<BasketLine> = [];
  for (const item of menu.data.items) {
    const qty = basket[item.id] ?? 0;
    if (qty > 0) lines.push({ item, qty, lineCents: item.priceCents * qty });
  }
  return lines;
});

export const selectBasketCount = createSelector(selectBasketLines, (lines) =>
  lines.reduce((sum, line) => sum + line.qty, 0),
);

export const selectBasketTotalCents = createSelector(selectBasketLines, (lines) =>
  lines.reduce((sum, line) => sum + line.lineCents, 0),
);

/** Portions left per item id (0 = sold out, null = unlimited). */
export const selectRemainingById = createSelector(selectMenu, (menu) => {
  const remaining: Record<string, number | null> = {};
  if (menu.status === 'ready') {
    for (const item of menu.data.items) remaining[item.id] = item.soldOut ? 0 : item.remaining;
  }
  return remaining;
});
