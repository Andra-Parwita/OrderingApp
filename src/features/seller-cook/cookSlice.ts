import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Order } from '../../../shared/domain';
import type { CookMenu } from './cookModel';

export type CookListState =
  { status: 'loading' } | { status: 'ready'; live: 'ok' | 'error' } | { status: 'error' };

export type CookState = { list: CookListState; orders: Array<Order>; menu: CookMenu | null };
export type CookRootState = { sellerCook: CookState };

const initialState: CookState = { list: { status: 'loading' }, orders: [], menu: null };

const cookSlice = createSlice({
  name: 'sellerCook',
  initialState,
  reducers: {
    /** The screen dispatches these on mount and unmount; the saga polls in between. */
    pollingStarted() {},
    pollingStopped() {},
    refreshRequested(state) {
      if (state.list.status === 'error') state.list = { status: 'loading' };
    },
    loaded(state, action: PayloadAction<{ orders: Array<Order>; menu: CookMenu }>) {
      // Keep the old objects when nothing changed, so memoised selectors do not recompute.
      if (JSON.stringify(state.orders) !== JSON.stringify(action.payload.orders)) {
        state.orders = action.payload.orders;
      }
      if (JSON.stringify(state.menu) !== JSON.stringify(action.payload.menu)) {
        state.menu = action.payload.menu;
      }
      state.list = { status: 'ready', live: 'ok' };
    },
    /** One order changed on this device (a tick or "Packed"); the next live reload confirms it. */
    orderReplaced(state, action: PayloadAction<Order>) {
      const index = state.orders.findIndex((order) => order.id === action.payload.id);
      if (index >= 0) state.orders[index] = action.payload;
    },
    loadFailed(state) {
      state.list =
        state.list.status === 'ready' ? { status: 'ready', live: 'error' } : { status: 'error' };
    },
  },
});

export const {
  pollingStarted,
  pollingStopped,
  refreshRequested,
  loaded,
  loadFailed,
  orderReplaced,
} = cookSlice.actions;
export const cookReducer = cookSlice.reducer;
