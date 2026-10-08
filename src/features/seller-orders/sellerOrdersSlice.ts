import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Order, OrderStatus, SellerMenuItemView } from '../../../shared/domain';
import type { CreateSellerOrderRequest } from '../../../shared/orderContract';

/** What the last failed change was, so the screen can offer a retry. */
export type FailedChange =
  | { kind: 'status'; code: string; to: OrderStatus }
  | { kind: 'paid'; code: string; paid: boolean }
  | { kind: 'lock'; code: string; locked: boolean }
  | { kind: 'wa'; code: string; received: boolean }
  | { kind: 'nudge'; code: string }
  | { kind: 'seen'; code: string };

/** The menu the seller adds orders from (with what is left of each limit). */
export type SellerMenuState =
  | { status: 'loading' }
  | { status: 'ready'; items: Array<SellerMenuItemView> }
  | { status: 'error' };

/** The "+ New order" form's request: idle, saving, failed (with the API error code) or saved. */
export type CreateState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'error'; error: string }
  | { status: 'saved'; order: Order };

/** One-off messages for the toast. */
export type Notice = 'nudged';

export type ListState =
  { status: 'loading' } | { status: 'ready'; live: 'ok' | 'error' } | { status: 'error' };

export type ChangeState =
  { status: 'idle' } | { status: 'saving' } | { status: 'error'; failed: FailedChange };

export type SellerOrdersState = {
  list: ListState;
  orders: Array<Order>;
  /** Local cooking date, YYYY-MM-DD, for the header; null until the menu is loaded. */
  cookingDate: string | null;
  // The list filter and search live in the URL (?status=&q=), not here.
  change: ChangeState;
  menu: SellerMenuState;
  create: CreateState;
  notice: Notice | null;
};
export type SellerOrdersRootState = { sellerOrders: SellerOrdersState };

const initialState: SellerOrdersState = {
  list: { status: 'loading' },
  orders: [],
  cookingDate: null,
  change: { status: 'idle' },
  menu: { status: 'loading' },
  create: { status: 'idle' },
  notice: null,
};

const sellerOrdersSlice = createSlice({
  name: 'sellerOrders',
  initialState,
  reducers: {
    /** Screens dispatch these on mount and unmount; the saga polls in between. */
    pollingStarted() {},
    pollingStopped() {},
    /** Retry button: fetch now. */
    refreshRequested(state) {
      if (state.list.status === 'error') state.list = { status: 'loading' };
    },
    ordersLoaded(state, action: PayloadAction<{ orders: Array<Order> }>) {
      // Keep the old object when nothing changed, so memoised rows do not re-render every poll.
      const previous = new Map(state.orders.map((order) => [order.id, order]));
      state.orders = action.payload.orders.map((order) => {
        const old = previous.get(order.id);
        return old && JSON.stringify(old) === JSON.stringify(order) ? old : order;
      });
      state.list = { status: 'ready', live: 'ok' };
    },
    ordersFailed(state) {
      state.list =
        state.list.status === 'ready' ? { status: 'ready', live: 'error' } : { status: 'error' };
    },
    weekLoaded(state, action: PayloadAction<{ cookingDate: string }>) {
      state.cookingDate = action.payload.cookingDate;
    },
    statusChangeRequested: {
      reducer(state) {
        state.change = { status: 'saving' };
      },
      prepare: (payload: { code: string; to: OrderStatus }) => ({ payload }),
    },
    paidChangeRequested: {
      reducer(state) {
        state.change = { status: 'saving' };
      },
      prepare: (payload: { code: string; paid: boolean }) => ({ payload }),
    },
    lockChangeRequested: {
      reducer(state) {
        state.change = { status: 'saving' };
      },
      prepare: (payload: { code: string; locked: boolean }) => ({ payload }),
    },
    waReceivedRequested: {
      reducer(state) {
        state.change = { status: 'saving' };
      },
      prepare: (payload: { code: string; received: boolean }) => ({ payload }),
    },
    nudgeRequested: {
      reducer(state) {
        state.change = { status: 'saving' };
      },
      prepare: (payload: { code: string }) => ({ payload }),
    },
    seenRequested: {
      reducer(state) {
        state.change = { status: 'saving' };
      },
      prepare: (payload: { code: string }) => ({ payload }),
    },
    noticeShown(state, action: PayloadAction<{ notice: Notice }>) {
      state.notice = action.payload.notice;
    },
    noticeCleared(state) {
      state.notice = null;
    },
    /** The "+ New order" screen asks for the menu on mount. */
    menuRequested(state) {
      if (state.menu.status === 'error') state.menu = { status: 'loading' };
    },
    menuLoaded(state, action: PayloadAction<{ items: Array<SellerMenuItemView> }>) {
      state.menu = { status: 'ready', items: action.payload.items };
    },
    menuFailed(state) {
      state.menu = { status: 'error' };
    },
    createOrderRequested: {
      reducer(state) {
        state.create = { status: 'saving' };
      },
      prepare: (payload: CreateSellerOrderRequest) => ({ payload }),
    },
    orderCreated(state, action: PayloadAction<{ order: Order }>) {
      const { order } = action.payload;
      state.orders = [order, ...state.orders.filter((candidate) => candidate.id !== order.id)];
      state.create = { status: 'saved', order };
    },
    createFailed(state, action: PayloadAction<{ error: string }>) {
      state.create = { status: 'error', error: action.payload.error };
    },
    createReset(state) {
      state.create = { status: 'idle' };
    },
    orderSaved(state, action: PayloadAction<{ order: Order }>) {
      const { order } = action.payload;
      const index = state.orders.findIndex((candidate) => candidate.id === order.id);
      if (index >= 0) state.orders[index] = order;
      else state.orders.unshift(order);
      state.change = { status: 'idle' };
    },
    changeFailed(state, action: PayloadAction<{ failed: FailedChange }>) {
      state.change = { status: 'error', failed: action.payload.failed };
    },
  },
});

export const {
  pollingStarted,
  pollingStopped,
  refreshRequested,
  ordersLoaded,
  ordersFailed,
  weekLoaded,
  statusChangeRequested,
  paidChangeRequested,
  lockChangeRequested,
  waReceivedRequested,
  nudgeRequested,
  seenRequested,
  noticeShown,
  noticeCleared,
  menuRequested,
  menuLoaded,
  menuFailed,
  createOrderRequested,
  orderCreated,
  createFailed,
  createReset,
  orderSaved,
  changeFailed,
} = sellerOrdersSlice.actions;
export const sellerOrdersReducer = sellerOrdersSlice.reducer;
