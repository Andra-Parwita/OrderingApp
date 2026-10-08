import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CustomerOrder } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import type { SavedOrder } from '../../api/device/myOrders';
import type { ApiFailure } from '../../api/http';

export type FailureCode = ApiFailure['error'];

export type ListState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; orders: Array<CustomerOrder>; saved: Array<SavedOrder> }
  | { status: 'error'; code: FailureCode };

export type OrderPageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; order: CustomerOrder }
  | { status: 'error'; code: FailureCode };

/** The week and kitchen: pickup details, the seller's WhatsApp number and whether ordering is open. */
export type MenuState =
  | { status: 'idle' }
  | { status: 'ready'; data: MenuResponse }
  | { status: 'error'; code: FailureCode };

export type CancelState =
  { status: 'idle' } | { status: 'submitting' } | { status: 'failed'; code: FailureCode };

export type CustomerOrdersState = {
  list: ListState;
  order: OrderPageState;
  menu: MenuState;
  cancel: CancelState;
};
export type CustomerOrdersRootState = { customerOrders: CustomerOrdersState };

const initialState: CustomerOrdersState = {
  list: { status: 'idle' },
  order: { status: 'idle' },
  menu: { status: 'idle' },
  cancel: { status: 'idle' },
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
      action: PayloadAction<{ orders: Array<CustomerOrder>; saved: Array<SavedOrder> }>,
    ) {
      state.list = { status: 'ready', ...action.payload };
    },
    listFailed(state, action: PayloadAction<FailureCode>) {
      state.list = { status: 'error', code: action.payload };
    },
    menuRequested() {
      // The saga loads it; the screen keeps showing the last good copy.
    },
    menuLoaded(state, action: PayloadAction<MenuResponse>) {
      state.menu = { status: 'ready', data: action.payload };
    },
    menuFailed(state, action: PayloadAction<FailureCode>) {
      if (state.menu.status !== 'ready') state.menu = { status: 'error', code: action.payload };
    },
    orderRequested: {
      reducer(state) {
        state.order = { status: 'loading' };
        state.cancel = { status: 'idle' };
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
    },
    orderFailed(state, action: PayloadAction<FailureCode>) {
      state.order = { status: 'error', code: action.payload };
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
  },
});

export const {
  listRequested,
  listLoaded,
  listFailed,
  menuRequested,
  menuLoaded,
  menuFailed,
  orderRequested,
  orderRefreshRequested,
  orderLoaded,
  orderFailed,
  cancelRequested,
  cancelFailed,
} = slice.actions;
export const customerOrdersReducer = slice.reducer;
