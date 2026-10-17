import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OrderStatus, SellerOrder } from '../../../shared/domain';
import type {
  CreatePrivateRequest,
  PrivateDue,
  UpdatePrivateRequest,
} from '../../../shared/privateContract';
import type { PrivateView } from './model';

export type PrivateAction =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'done'; kind: 'save' | 'cancel' | 'status'; order: SellerOrder }
  | { status: 'error'; kind: 'save' | 'cancel' | 'status'; code: string };

export type PrivateState = {
  /** `loading` until the first answer; `error` while nothing has loaded. */
  load: 'loading' | 'ready' | 'error';
  view: PrivateView;
  /** The list screen is open: reloads fetch its orders, not only the counts. */
  listOpen: boolean;
  /** The detail screen's order code, reloaded with the list. */
  detailCode: string | null;
  orders: Array<SellerOrder>;
  detail: SellerOrder | null;
  due: PrivateDue;
  /** The kitchen's date as the server sees it; null before the first load. */
  today: string | null;
  action: PrivateAction;
};
export type PrivateRootState = { sellerPrivate: PrivateState };

const initialState: PrivateState = {
  load: 'loading',
  view: 'upcoming',
  listOpen: false,
  detailCode: null,
  orders: [],
  detail: null,
  due: { today: 0, tomorrow: 0 },
  today: null,
  action: { status: 'idle' },
};

const privateSlice = createSlice({
  name: 'sellerPrivate',
  initialState,
  reducers: {
    /** The shell (rail, phone bar) and the screens start and stop the live reloads (counted by the hook). */
    pollingStarted() {},
    pollingStopped() {},
    refreshRequested(state) {
      if (state.load === 'error') state.load = 'loading';
    },
    listOpened(state, action: PayloadAction<PrivateView>) {
      state.listOpen = true;
      if (state.view !== action.payload) {
        state.view = action.payload;
        state.orders = [];
      }
      if (state.orders.length === 0) state.load = 'loading';
    },
    listClosed(state) {
      state.listOpen = false;
    },
    viewChanged(state, action: PayloadAction<PrivateView>) {
      if (state.view === action.payload) return;
      state.view = action.payload;
      state.orders = [];
      state.load = 'loading';
    },
    detailOpened(state, action: PayloadAction<string>) {
      if (state.detail && state.detail.code !== action.payload) state.detail = null;
      state.detailCode = action.payload;
    },
    detailClosed(state) {
      state.detailCode = null;
      state.detail = null;
    },
    loaded(
      state,
      action: PayloadAction<{
        due: PrivateDue;
        today: string;
        /** With the view they were read for; an answer for another view is dropped. */
        orders?: { view: PrivateView; list: Array<SellerOrder> };
        detail?: SellerOrder;
      }>,
    ) {
      const { due, today, orders, detail } = action.payload;
      if (orders && orders.view === state.view) {
        if (JSON.stringify(state.orders) !== JSON.stringify(orders.list))
          state.orders = orders.list;
      }
      if (detail && JSON.stringify(state.detail) !== JSON.stringify(detail)) state.detail = detail;
      if (JSON.stringify(state.due) !== JSON.stringify(due)) state.due = due;
      state.today = today;
      // A counts-only answer, read before the list opened, does not make the list ready.
      if (orders || !state.listOpen) state.load = 'ready';
    },
    loadFailed(state) {
      if (state.load !== 'ready') state.load = 'error';
    },
    /** The editor's Save: create (no code) or edit. */
    saveRequested: {
      reducer(state) {
        state.action = { status: 'saving' };
      },
      prepare: (input: {
        code: string | null;
        request: CreatePrivateRequest | UpdatePrivateRequest;
      }) => ({ payload: input }),
    },
    cancelRequested: {
      reducer(state) {
        state.action = { status: 'saving' };
      },
      prepare: (code: string) => ({ payload: { code } }),
    },
    statusRequested: {
      reducer(state) {
        state.action = { status: 'saving' };
      },
      prepare: (input: { code: string; to: OrderStatus }) => ({ payload: input }),
    },
    /** A write's own answer: the list and the open order take it at once. */
    orderSaved(
      state,
      action: PayloadAction<{ kind: 'save' | 'cancel' | 'status'; order: SellerOrder }>,
    ) {
      const { order, kind } = action.payload;
      const index = state.orders.findIndex((candidate) => candidate.code === order.code);
      if (index >= 0) state.orders[index] = order;
      if (state.detailCode === order.code) state.detail = order;
      state.action = { status: 'done', kind, order };
    },
    actionFailed(
      state,
      action: PayloadAction<{ kind: 'save' | 'cancel' | 'status'; code: string }>,
    ) {
      state.action = { status: 'error', ...action.payload };
    },
    actionCleared(state) {
      state.action = { status: 'idle' };
    },
  },
});

export const {
  pollingStarted,
  pollingStopped,
  refreshRequested,
  listOpened,
  listClosed,
  viewChanged,
  detailOpened,
  detailClosed,
  loaded,
  loadFailed,
  saveRequested,
  cancelRequested,
  statusRequested,
  orderSaved,
  actionFailed,
  actionCleared,
} = privateSlice.actions;
export const privateReducer = privateSlice.reducer;
