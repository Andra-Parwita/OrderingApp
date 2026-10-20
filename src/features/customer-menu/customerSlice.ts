import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ApiFailure } from '../../api/http';
import type { DeliveryAddress } from '../../../shared/address';
import type { Fulfilment, Language, CustomerOrder, LocalText } from '../../../shared/domain';
import { MAX_QTY, NOTE_MAX } from '../../../shared/limits';
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

/**
 * What the checkout pages (basket, pickup place, your name) share. `null` = not picked yet: an
 * edited order then shows its own fulfilment and note.
 */
export type CheckoutState = {
  fulfilment: Fulfilment | null;
  pickupPlaceId: string | null;
  firstName: string;
  note: string | null;
  /** Plan 071: the delivery address typed (or chosen) at checkout; null = none typed yet. */
  address: DeliveryAddress | null;
};

/** A basket line the new stock could not cover: it was removed (`sold_out`) or lowered (`fewer`). */
export type BasketNotice = {
  kind: 'sold_out' | 'fewer';
  itemId: string;
  name: LocalText;
  /** The quantity the basket holds now (0 when removed). */
  qty: number;
};

export type CustomerState = {
  /** The seller whose menu is loaded or loading (D-037). */
  slug: string | null;
  menu: MenuState;
  /** itemId to quantity; items at 0 are removed. */
  basket: Record<string, number>;
  /** Plan 111: a short note per basket line (itemId to text); only for items in the basket. */
  basketNotes: Record<string, string>;
  checkout: CheckoutState;
  /** What changed in the basket when a refreshed menu could not cover it; shown as a banner. */
  notices: Array<BasketNotice>;
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
  /** D-061: the pickup place chosen at checkout (a pickup order). */
  pickupPlaceId?: string;
  /** Plan 071: a complete delivery address, only for a delivery order. */
  address?: DeliveryAddress;
};

export type UpdateRequest = {
  fulfilment: Fulfilment;
  note: string;
  /** Plan 071: the address to keep (a delivery order); absent = leave it as it is. */
  address?: DeliveryAddress;
};

const emptyCheckout: CheckoutState = {
  fulfilment: null,
  pickupPlaceId: null,
  firstName: '',
  note: null,
  address: null,
};

const initialState: CustomerState = {
  slug: null,
  menu: { status: 'idle' },
  basket: {},
  basketNotes: {},
  checkout: emptyCheckout,
  notices: [],
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
    menuRequested: {
      reducer(state, action: PayloadAction<string>) {
        if (state.slug !== action.payload) {
          // Another seller: the old menu and basket are not theirs. (An order being edited
          // brings its own basket.)
          state.slug = action.payload;
          state.menu = { status: 'loading' };
          if (state.edit.status === 'idle') {
            state.basket = {};
            state.basketNotes = {};
          }
          state.checkout = emptyCheckout;
          state.notices = [];
        } else if (state.menu.status !== 'ready') {
          // Keep showing the old menu while it refreshes.
          state.menu = { status: 'loading' };
        }
      },
      prepare: (slug: string) => ({ payload: slug }),
    },
    menuLoaded(state, action: PayloadAction<MenuResponse>) {
      state.menu = { status: 'ready', data: action.payload };
      // Drop or trim basket lines the new stock can no longer cover.
      const notices: Array<BasketNotice> = [];
      for (const [itemId, qty] of Object.entries(state.basket)) {
        const max = maxFor(state, itemId);
        const item = action.payload.items.find((candidate) => candidate.id === itemId);
        if (max === 0) {
          delete state.basket[itemId];
          delete state.basketNotes[itemId];
          if (item) notices.push({ kind: 'sold_out', itemId, name: item.name, qty: 0 });
        } else if (qty > max) {
          state.basket[itemId] = max;
          if (item) notices.push({ kind: 'fewer', itemId, name: item.name, qty: max });
        }
      }
      if (notices.length > 0) state.notices = notices;
    },
    menuFailed(state, action: PayloadAction<FailureCode>) {
      state.menu = { status: 'error', code: action.payload };
    },
    quantitySet(state, action: PayloadAction<{ itemId: string; qty: number }>) {
      const { itemId, qty } = action.payload;
      const next = Math.max(0, Math.min(Math.floor(qty), maxFor(state, itemId)));
      if (next === 0) {
        delete state.basket[itemId];
        delete state.basketNotes[itemId];
      } else state.basket[itemId] = next;
      // The customer has acted on what the banner said.
      state.notices = [];
    },
    /** Plan 111: set (or, when empty, remove) the note of a line that is in the basket. */
    noteSet(state, action: PayloadAction<{ itemId: string; note: string }>) {
      const { itemId } = action.payload;
      if (!state.basket[itemId]) return;
      const note = action.payload.note.trim().slice(0, NOTE_MAX);
      if (note === '') delete state.basketNotes[itemId];
      else state.basketNotes[itemId] = note;
    },
    /** Plan 061: a basket and checkout typed before a reload, put back once the menu is known. */
    basketRestored(
      state,
      action: PayloadAction<{
        basket: Record<string, number>;
        names: Record<string, LocalText>;
        notes?: Record<string, string>;
        checkout: CheckoutState;
      }>,
    ) {
      if (state.menu.status !== 'ready' || state.edit.status !== 'idle') return;
      if (Object.keys(state.basket).length > 0) return;
      const { data } = state.menu;
      const notices: Array<BasketNotice> = [];
      for (const [itemId, qty] of Object.entries(action.payload.basket)) {
        const name = action.payload.names[itemId] ?? { en: itemId, id: itemId };
        if (!data.items.some((candidate) => candidate.id === itemId)) {
          // No longer on the menu: dropped, and the usual banner says so.
          notices.push({ kind: 'sold_out', itemId, name, qty: 0 });
          continue;
        }
        const max = maxFor(state, itemId);
        const next = Math.min(Math.floor(qty), max);
        if (next <= 0) notices.push({ kind: 'sold_out', itemId, name, qty: 0 });
        else {
          state.basket[itemId] = next;
          const saved = action.payload.notes?.[itemId];
          if (saved) state.basketNotes[itemId] = saved.slice(0, NOTE_MAX);
          if (next < qty) notices.push({ kind: 'fewer', itemId, name, qty: next });
        }
      }
      const saved = action.payload.checkout;
      const places = data.week.pickupPoints;
      state.checkout = {
        fulfilment:
          saved.fulfilment === 'delivery' && !data.week.delivery.available
            ? null
            : saved.fulfilment,
        pickupPlaceId: places.some((place) => place.id === saved.pickupPlaceId)
          ? saved.pickupPlaceId
          : null,
        // What is already on the page (a saved first name, say) wins over the stored draft.
        firstName: state.checkout.firstName !== '' ? state.checkout.firstName : saved.firstName,
        note: state.checkout.note ?? saved.note,
        address: state.checkout.address ?? saved.address ?? null,
      };
      if (notices.length > 0) state.notices = notices;
    },
    /** Checkout fields the pages share (fulfilment, pickup place, first name, note, address). */
    checkoutSet(state, action: PayloadAction<Partial<CheckoutState>>) {
      state.checkout = { ...state.checkout, ...action.payload };
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
      state.basketNotes = {};
      state.checkout = emptyCheckout;
      state.notices = [];
    },
    placeFailed(state, action: PayloadAction<{ code: FailureCode; message: string }>) {
      state.place = { status: 'failed', ...action.payload };
    },
    /** Clears a failed place or update, so an old error does not greet the next try. */
    placeReset(state) {
      state.place = { status: 'idle' };
      if (state.update.status === 'failed') state.update = { status: 'idle' };
    },
    editRequested: {
      reducer(state) {
        state.edit = { status: 'loading' };
        state.update = { status: 'idle' };
        state.checkout = emptyCheckout;
        state.notices = [];
      },
      prepare: (token: string) => ({ payload: token }),
    },
    editLoaded(state, action: PayloadAction<CustomerOrder>) {
      const original: Record<string, number> = {};
      for (const line of action.payload.lines) original[line.itemId] = line.qty;
      state.edit = { status: 'ready', order: action.payload, original };
      state.basket = { ...original };
      state.basketNotes = {};
      for (const line of action.payload.lines) {
        if (line.note) state.basketNotes[line.itemId] = line.note;
      }
    },
    editFailed(state, action: PayloadAction<FailureCode>) {
      state.edit = { status: 'error', code: action.payload };
    },
    /** Leaving the edit screen: the basket is emptied so it cannot leak into a new order. */
    editCleared(state) {
      if (state.edit.status !== 'idle') {
        state.basket = {};
        state.basketNotes = {};
      }
      state.checkout = emptyCheckout;
      state.notices = [];
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
  noteSet,
  checkoutSet,
  basketRestored,
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
