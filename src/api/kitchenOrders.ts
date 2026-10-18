import { createAction } from '@reduxjs/toolkit';
import type { Order } from '../../shared/domain';

/**
 * Plan 098 C5: the kitchen's orders live in the `sellerOrders` slice (features/seller-orders).
 * Cook and Pack read them from there, but a feature may not import another feature, so this
 * is the contract between the two: the state shape Cook reads and the actions it sends or hears.
 * The type strings are the Orders slice's own; seller-orders/kitchenOrders.test.ts checks they match.
 */
export type KitchenOrdersListState =
  { status: 'loading' } | { status: 'ready'; live: 'ok' | 'error' } | { status: 'error' };

export type KitchenOrdersRootState = {
  sellerOrders: {
    list: KitchenOrdersListState;
    orders: Array<Order>;
    current: { status: 'loading' | 'ready' | 'error' };
  };
};

/** A screen needs the live orders (counted: the loop runs while at least one screen asks). */
export const ordersPollingStarted = createAction('sellerOrders/pollingStarted');
export const ordersPollingStopped = createAction('sellerOrders/pollingStopped');
export const ordersRefreshRequested = createAction('sellerOrders/refreshRequested');
/** The list was fetched (a live event, a reconnect or a backup check). */
export const ordersLoaded = createAction<{ orders: Array<Order> }>('sellerOrders/ordersLoaded');
/** The current menu was fetched (a `menu.changed` event or the first load). */
export const currentMenuLoaded = createAction<{ view: unknown }>('sellerOrders/currentLoaded');
/** One order changed on this device (a Pack tick). */
export const orderPatched = createAction<Order>('sellerOrders/orderPatched');
