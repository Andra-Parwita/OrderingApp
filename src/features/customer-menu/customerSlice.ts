import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ApiFailure } from '../../api/http';
import type { Fulfilment, Language, CustomerOrder } from '../../../shared/domain';
import { MAX_QTY } from '../../../shared/limits';
import type { MenuResponse } from '../../../shared/menuContract';

export type FailureCode = ApiFailure['error'];

export type MenuState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: MenuResponse }
  | { status: 'error'; code: FailureCode };

/** The result of "Place order". */
export type PlaceState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'placed'; token: string }
  | { status: 'failed'; code: FailureCode; message: string };

/** The order shown on C3 (just placed, or loaded by its token). */
export type OrderState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; order: CustomerOrder }
  | { status: 'error'; code: FailureCode };

/**
 * Editing an existing order: its lines load into the basket. `original` is the quantity the order
 * already holds per item (the menu's portions left already count it).
 */
export type EditState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; order: CustomerOrder; original: Record<string, number> }
  | { status: 'error'; code: FailureCode };

/** The result of "Update order". */
export type UpdateState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'done' }
  | { status: 'failed'; code: FailureCode; message: string };

export type CustomerState = {
  menu: MenuState;
  /** itemId to quantity; items at 0 are removed. */
  basket: Record<string, number>;
  place: PlaceState;
  order: OrderState;
  edit: EditState;
  update: UpdateState;
};
export type CustomerRootState = { customer: CustomerState };

export type PlaceRequest = {
  firstName: string;
  language: Language;
  fulfilment: Fulfilment;
  note: string;
};

export type UpdateRequest = { fulfilment: Fulfilment; note: string };

const initialState: CustomerState = {
  menu: { status: 'idle' },
  basket: {},
  place: { status: 'idle' },
  order: { status: 'idle' },
  edit: { status: 'idle' },
  update: { status: 'idle' },
};

/** Most of this item that can be in the basket: the portion limit left (plus the order's own), else the line maximum. */
function maxFor(state: CustomerState, itemId: string): number {
  const { menu, edit } = state;
  if (menu.status !== 'ready') return MAX_QTY;
  const own = edit.status === 'ready' ? (edit.original[itemId] ?? 0) : 0;
  const item = menu.data.items.find((candidate) => candidate.id === itemId);
  if (!item) return 0;
  if (item.remaining === null) return item.soldOut ? 0 : MAX_QTY;
  return Math.min(MAX_QTY, item.remaining + own);
}

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    menuRequested(state) {
      // Keep showing the old menu while it refreshes.
      if (state.menu.status !== 'ready') state.menu = { status: 'loading' };
    },
    menuLoaded(state, action: PayloadAction<MenuResponse>) {
      state.menu = { status: 'ready', data: action.payload };
      // Drop or trim basket lines the new stock can no longer cover.
      for (const [itemId, qty] of Object.entries(state.basket)) {
        const max = maxFor(state, itemId);
        if (max === 0) delete state.basket[itemId];
        else if (qty > max) state.basket[itemId] = max;
      }
    },
    menuFailed(state, action: PayloadAction<FailureCode>) {
      state.menu = { status: 'error', code: action.payload };
    },
    quantitySet(state, action: PayloadAction<{ itemId: string; qty: number }>) {
      const { itemId, qty } = action.payload;
      const next = Math.max(0, Math.min(Math.floor(qty), maxFor(state, itemId)));
      if (next === 0) delete state.basket[itemId];
      else state.basket[itemId] = next;
    },
    placeRequested: {
      reducer(state) {
        state.place = { status: 'submitting' };
      },
      // The saga reads the payload; the reducer only needs to know a request started.
      prepare: (request: PlaceRequest) => ({ payload: request }),
    },
    placeSucceeded(state, action: PayloadAction<CustomerOrder>) {
      state.place = { status: 'placed', token: action.payload.token };
      state.order = { status: 'ready', order: action.payload };
      state.basket = {};
    },
    placeFailed(state, action: PayloadAction<{ code: FailureCode; message: string }>) {
      state.place = { status: 'failed', ...action.payload };
    },
    placeReset(state) {
      state.place = { status: 'idle' };
    },
    editRequested: {
      reducer(state) {
        state.edit = { status: 'loading' };
        state.update = { status: 'idle' };
      },
      prepare: (token: string) => ({ payload: token }),
    },
    editLoaded(state, action: PayloadAction<CustomerOrder>) {
      const original: Record<string, number> = {};
      for (const line of action.payload.lines) original[line.itemId] = line.qty;
      state.edit = { status: 'ready', order: action.payload, original };
      state.basket = { ...original };
    },
    editFailed(state, action: PayloadAction<FailureCode>) {
      state.edit = { status: 'error', code: action.payload };
    },
    /** Leaving the edit screen: the basket is emptied so it cannot leak into a new order. */
    editCleared(state) {
      if (state.edit.status !== 'idle') state.basket = {};
      state.edit = { status: 'idle' };
      state.update = { status: 'idle' };
    },
    updateRequested: {
      reducer(state) {
        state.update = { status: 'submitting' };
      },
      prepare: (request: UpdateRequest) => ({ payload: request }),
    },
    updateSucceeded(state, action: PayloadAction<CustomerOrder>) {
      state.update = { status: 'done' };
      state.order = { status: 'ready', order: action.payload };
    },
    updateFailed(state, action: PayloadAction<{ code: FailureCode; message: string }>) {
      state.update = { status: 'failed', ...action.payload };
    },
    orderRequested: {
      reducer(state) {
        state.order = { status: 'loading' };
      },
      prepare: (token: string) => ({ payload: token }),
    },
    orderLoaded(state, action: PayloadAction<CustomerOrder>) {
      state.order = { status: 'ready', order: action.payload };
    },
    orderFailed(state, action: PayloadAction<FailureCode>) {
      state.order = { status: 'error', code: action.payload };
    },
  },
});

export const {
  menuRequested,
  menuLoaded,
  menuFailed,
  quantitySet,
  placeRequested,
  placeSucceeded,
  placeFailed,
  placeReset,
  editRequested,
  editLoaded,
  editFailed,
  editCleared,
  updateRequested,
  updateSucceeded,
  updateFailed,
  orderRequested,
  orderLoaded,
  orderFailed,
} = customerSlice.actions;
export const customerReducer = customerSlice.reducer;
