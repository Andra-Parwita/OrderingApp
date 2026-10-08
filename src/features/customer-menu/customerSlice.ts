import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ApiFailure } from '../../api/http';
import type { Fulfilment, Language, Order } from '../../../shared/domain';
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
  | { status: 'ready'; order: Order }
  | { status: 'error'; code: FailureCode };

export type CustomerState = {
  menu: MenuState;
  /** itemId to quantity; items at 0 are removed. */
  basket: Record<string, number>;
  place: PlaceState;
  order: OrderState;
};
export type CustomerRootState = { customer: CustomerState };

export type PlaceRequest = {
  firstName: string;
  language: Language;
  fulfilment: Fulfilment;
  note: string;
};

const initialState: CustomerState = {
  menu: { status: 'idle' },
  basket: {},
  place: { status: 'idle' },
  order: { status: 'idle' },
};

/** Most of this item that can be in the basket: the portion limit left, else the line maximum. */
function maxFor(menu: MenuState, itemId: string): number {
  if (menu.status !== 'ready') return MAX_QTY;
  const item = menu.data.items.find((candidate) => candidate.id === itemId);
  if (!item || item.soldOut) return 0;
  return Math.min(MAX_QTY, item.remaining ?? MAX_QTY);
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
        const max = maxFor(state.menu, itemId);
        if (max === 0) delete state.basket[itemId];
        else if (qty > max) state.basket[itemId] = max;
      }
    },
    menuFailed(state, action: PayloadAction<FailureCode>) {
      state.menu = { status: 'error', code: action.payload };
    },
    quantitySet(state, action: PayloadAction<{ itemId: string; qty: number }>) {
      const { itemId, qty } = action.payload;
      const next = Math.max(0, Math.min(Math.floor(qty), maxFor(state.menu, itemId)));
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
    placeSucceeded(state, action: PayloadAction<Order>) {
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
    orderRequested: {
      reducer(state) {
        state.order = { status: 'loading' };
      },
      prepare: (token: string) => ({ payload: token }),
    },
    orderLoaded(state, action: PayloadAction<Order>) {
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
  orderRequested,
  orderLoaded,
  orderFailed,
} = customerSlice.actions;
export const customerReducer = customerSlice.reducer;
