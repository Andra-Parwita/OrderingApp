import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Order, OrderStatus } from '../../../shared/domain';

/** What the last failed change was, so the screen can offer a retry. */
export type FailedChange =
  { kind: 'status'; code: string; to: OrderStatus } | { kind: 'paid'; code: string; paid: boolean };

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
};
export type SellerOrdersRootState = { sellerOrders: SellerOrdersState };

const initialState: SellerOrdersState = {
  list: { status: 'loading' },
  orders: [],
  cookingDate: null,
  change: { status: 'idle' },
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
    /** Dev only: add sample orders / reset the mock store, then reload the list. */
    devSampleOrdersRequested() {},
    devResetRequested() {},
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
  orderSaved,
  changeFailed,
  devSampleOrdersRequested,
  devResetRequested,
} = sellerOrdersSlice.actions;
export const sellerOrdersReducer = sellerOrdersSlice.reducer;
