import { createSelector } from '@reduxjs/toolkit';
import type { MenuItemView } from '../../../shared/domain';
import type { CustomerRootState } from './customerSlice';

/** `max`: most of this item the basket may hold (undefined = no limit); an edited order's own portions count. */
export type BasketLine = Readonly<{
  item: MenuItemView;
  qty: number;
  lineCents: number;
  max: number | undefined;
}>;

const EMPTY_LINES: ReadonlyArray<BasketLine> = [];

export const selectMenu = (state: CustomerRootState) => state.customer.menu;
export const selectBasket = (state: CustomerRootState) => state.customer.basket;
export const selectPlace = (state: CustomerRootState) => state.customer.place;
export const selectMenuSlug = (state: CustomerRootState) => state.customer.slug;
/** True when the server said this seller does not exist (a mistyped or old link). */
export const selectKitchenMissing = (state: CustomerRootState, slug: string) =>
  state.customer.slug === slug &&
  state.customer.menu.status === 'error' &&
  state.customer.menu.code === 'seller_not_found';
export const selectOrder = (state: CustomerRootState) => state.customer.order;

/** Basket lines in menu order; items no longer on the menu are left out. */
export const selectBasketLines = createSelector(
  [selectMenu, selectBasket, (state: CustomerRootState) => state.customer.edit],
  (menu, basket, edit) => {
    if (menu.status !== 'ready') return EMPTY_LINES;
    const lines: Array<BasketLine> = [];
    for (const item of menu.data.items) {
      const qty = basket[item.id] ?? 0;
      if (qty > 0) {
        const own = edit.status === 'ready' ? (edit.original[item.id] ?? 0) : 0;
        const max = item.remaining === null ? undefined : item.remaining + own;
        lines.push({ item, qty, lineCents: item.priceCents * qty, max });
      }
    }
    return lines;
  },
);

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

export const selectEdit = (state: CustomerRootState) => state.customer.edit;
export const selectUpdate = (state: CustomerRootState) => state.customer.update;
