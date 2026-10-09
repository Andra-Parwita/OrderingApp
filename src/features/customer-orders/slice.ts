import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CustomerOrder } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import type { ExpiredOrder } from '../../../shared/orderContract';
import type { SavedOrder } from '../../api/device/myOrders';
import type { ApiFailure } from '../../api/http';

export type FailureCode = ApiFailure['error'];

export type ListState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ready';
      orders: Array<CustomerOrder>;
      /** Closed-week orders whose details are gone (D-044): shown as a one-line entry. */
      expired: Array<ExpiredOrder>;
      saved: Array<SavedOrder>;
      /** The last refresh failed (offline, say): what is shown is the last data that loaded. */
      stale?: FailureCode;
    }
  | { status: 'error'; code: FailureCode };

export type OrderPageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; order: CustomerOrder; stale?: FailureCode }
  | { status: 'expired'; order: ExpiredOrder }
  | { status: 'error'; code: FailureCode };

/**
 * The week and kitchen of each seller the phone has orders with, by slug: pickup details, the
 * seller's WhatsApp number and whether ordering is open. A seller that failed to load is absent.
 */
export type MenusState = Record<string, MenuResponse>;

export type CancelState =
  { status: 'idle' } | { status: 'submitting' } | { status: 'failed'; code: FailureCode };

/** "I've collected it" (D-069 Q4): same shape as cancel. */
export type CollectState = CancelState;

export type CustomerOrdersState = {
  list: ListState;
  order: OrderPageState;
  menus: MenusState;
  cancel: CancelState;
  collect: CollectState;
};
export type CustomerOrdersRootState = { customerOrders: CustomerOrdersState };

const initialState: CustomerOrdersState = {
  list: { status: 'idle' },
  order: { status: 'idle' },
  menus: {},
  cancel: { status: 'idle' },
  collect: { status: 'idle' },
};

const slice = createSlice({
  name: 'customerOrders',
  initialState,
  reducers: {
    listRequested(state) {
      // Keep the old list on screen while it refreshes.
      if (state.list.status !== 'ready') state.list = { status: 'loading' };
    },
    listLoaded(
      state,
      action: PayloadAction<{
        orders: Array<CustomerOrder>;
        expired?: Array<ExpiredOrder>;
        saved: Array<SavedOrder>;
      }>,
    ) {
      state.list = { status: 'ready', ...action.payload, expired: action.payload.expired ?? [] };
    },
    listFailed(state, action: PayloadAction<FailureCode>) {
      // Keep the last good list on screen (spec §8, offline); only a first load shows an error.
      if (state.list.status === 'ready') state.list.stale = action.payload;
      else state.list = { status: 'error', code: action.payload };
    },
    menuRequested: {
      reducer() {
        // The saga loads it; the screen keeps showing the last good copy.
      },
      prepare: (slug: string) => ({ payload: slug }),
    },
    menuLoaded(state, action: PayloadAction<MenuResponse>) {
      state.menus[action.payload.seller.slug] = action.payload;
    },
    orderRequested: {
      reducer(state, action: PayloadAction<string>) {
        // The same order, already on screen, stays there while it reloads.
        const same = state.order.status === 'ready' && state.order.order.token === action.payload;
        if (!same) state.order = { status: 'loading' };
        state.cancel = { status: 'idle' };
        state.collect = { status: 'idle' };
      },
      prepare: (token: string) => ({ payload: token }),
    },
    /** A quiet reload (the 15 s poll): no spinner, and a failure keeps what is on screen. */
    orderRefreshRequested: {
      reducer() {
        // The saga loads it.
      },
      prepare: (token: string) => ({ payload: token }),
    },
    orderLoaded(state, action: PayloadAction<CustomerOrder>) {
      state.order = { status: 'ready', order: action.payload };
      state.cancel = { status: 'idle' };
      state.collect = { status: 'idle' };
    },
    orderExpired(state, action: PayloadAction<ExpiredOrder>) {
      state.order = { status: 'expired', order: action.payload };
      state.cancel = { status: 'idle' };
    },
    orderFailed(state, action: PayloadAction<FailureCode>) {
      if (state.order.status === 'ready') state.order.stale = action.payload;
      else state.order = { status: 'error', code: action.payload };
    },
    cancelRequested: {
      reducer(state) {
        state.cancel = { status: 'submitting' };
      },
      prepare: (token: string) => ({ payload: token }),
    },
    cancelFailed(state, action: PayloadAction<FailureCode>) {
      state.cancel = { status: 'failed', code: action.payload };
    },
    collectRequested: {
      reducer(state) {
        state.collect = { status: 'submitting' };
      },
      prepare: (token: string) => ({ payload: token }),
    },
    collectFailed(state, action: PayloadAction<FailureCode>) {
      state.collect = { status: 'failed', code: action.payload };
    },
  },
});

export const {
  listRequested,
  listLoaded,
  listFailed,
  menuRequested,
  menuLoaded,
  orderRequested,
  orderRefreshRequested,
  orderLoaded,
  orderExpired,
  orderFailed,
  cancelRequested,
  cancelFailed,
  collectRequested,
  collectFailed,
} = slice.actions;
export const customerOrdersReducer = slice.reducer;
