import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ApiWarning } from '../../../shared/apiError';
import type { Order, OrderStatus, SellerMenuItemView } from '../../../shared/domain';
import type { MenuView } from '../../../shared/menusContract';
import type { PastWeekSummary } from '../../../shared/pastWeeks';
import type { UpdateItemRequest } from '../../../shared/setupContract';
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

/** The current menu: its state decides what Home shows. */
export type CurrentMenuState =
  { status: 'loading' } | { status: 'ready'; view: MenuView } | { status: 'error' };

/** Earlier menus (closed weeks): totals only. */
export type PastMenusState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; weeks: Array<PastWeekSummary> }
  | { status: 'error' };

/** A call the server answered with an overridable warning (D-062). Continue anyway sends it again with force. */
export type WarnedCall =
  | { kind: 'status'; code: string; to: OrderStatus; from?: OrderStatus }
  | { kind: 'collected'; code: string }
  | { kind: 'nudge'; code: string }
  | { kind: 'create'; request: CreateSellerOrderRequest };
export type Warned = { call: WarnedCall; warning: ApiWarning; name: string };

/** How to take a quick action back (only where the API allows it). */
export type UndoAction =
  { kind: 'status'; code: string; to: OrderStatus } | { kind: 'paid'; code: string; paid: boolean };
export type ToastKind =
  | 'confirmed'
  | 'paid'
  | 'cancelled'
  | 'collected'
  // Dev "add sample orders" answers; `name` carries the count.
  | 'sampleAdded'
  | 'samplePartial'
  | 'sampleNone'
  | 'sampleNoMenu'
  | 'sampleFailed'
  // Plan 013 "Clear samples"; `name` carries the count.
  | 'samplesCleared'
  | 'clearFailed';
/** What just happened, for the toast; undo is null where no Undo exists; id restarts the 6 s timer. */
export type ActionToast = { id: number; kind: ToastKind; name: string; undo: UndoAction | null };

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
  current: CurrentMenuState;
  past: PastMenusState;
  warned: Warned | null;
  toast: ActionToast | null;
  /** Dev only: a sample-orders request is running (the button waits). */
  devSampling: boolean;
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
  current: { status: 'loading' },
  past: { status: 'idle' },
  warned: null,
  toast: null,
  devSampling: false,
};

let toastId = 0;

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
      prepare: (payload: {
        code: string;
        to: OrderStatus;
        /** The status it had, so Undo can go back (confirm, cancel). */
        from?: OrderStatus;
        force?: boolean;
        /** An Undo: no toast afterwards. */
        undo?: boolean;
      }) => ({ payload }),
    },
    paidChangeRequested: {
      reducer(state) {
        state.change = { status: 'saving' };
      },
      prepare: (payload: { code: string; paid: boolean; undo?: boolean }) => ({ payload }),
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
      prepare: (payload: { code: string; force?: boolean }) => ({ payload }),
    },
    seenRequested: {
      reducer(state) {
        state.change = { status: 'saving' };
      },
      prepare: (payload: { code: string }) => ({ payload }),
    },
    collectedRequested: {
      reducer(state) {
        state.change = { status: 'saving' };
      },
      prepare: (payload: { code: string; force?: boolean }) => ({ payload }),
    },
    /** The server asked the seller to confirm: the dialog opens. */
    warningRaised(state, action: PayloadAction<Warned>) {
      state.warned = action.payload;
      state.change = { status: 'idle' };
      if (action.payload.call.kind === 'create') state.create = { status: 'idle' };
    },
    /** "Continue anyway": the saga sends the same call again with force. */
    warningConfirmed() {},
    warningDismissed(state) {
      state.warned = null;
    },
    toastShown: {
      reducer(state, action: PayloadAction<ActionToast>) {
        state.toast = action.payload;
      },
      prepare: (payload: Omit<ActionToast, 'id'>) => ({ payload: { ...payload, id: ++toastId } }),
    },
    toastCleared(state) {
      state.toast = null;
    },
    devSamplingChanged(state, action: PayloadAction<boolean>) {
      state.devSampling = action.payload;
    },
    currentRequested(state) {
      if (state.current.status === 'error') state.current = { status: 'loading' };
    },
    currentLoaded(state, action: PayloadAction<{ view: MenuView }>) {
      state.current = { status: 'ready', view: action.payload.view };
      state.cookingDate = action.payload.view.menu.cookingDate;
    },
    currentFailed(state) {
      if (state.current.status !== 'ready') state.current = { status: 'error' };
    },
    /** The Taking orders switch. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- saga-only action: the reducer ignores it
    takingOrdersRequested(_state, _action: PayloadAction<{ value: boolean }>) {},
    /** Live Dishes panel: edit one dish's limit or sold out (today's menu item route). */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- saga-only action: the reducer ignores it
    dishPatchRequested(_state, _action: PayloadAction<{ id: string; patch: UpdateItemRequest }>) {},
    pastRequested(state) {
      if (state.past.status !== 'ready') state.past = { status: 'loading' };
    },
    pastLoaded(state, action: PayloadAction<{ weeks: Array<PastWeekSummary> }>) {
      state.past = { status: 'ready', weeks: action.payload.weeks };
    },
    pastFailed(state) {
      state.past = { status: 'error' };
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
  collectedRequested,
  warningRaised,
  warningConfirmed,
  warningDismissed,
  toastShown,
  toastCleared,
  devSamplingChanged,
  currentRequested,
  currentLoaded,
  currentFailed,
  takingOrdersRequested,
  dishPatchRequested,
  pastRequested,
  pastLoaded,
  pastFailed,
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
