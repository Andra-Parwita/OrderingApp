import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Order } from '../../../shared/domain';
import type { CookMenu } from './cookModel';
import { orderPatched, type KitchenOrdersRootState } from '../../api/kitchenOrders';

export type CookListState =
  { status: 'loading' } | { status: 'ready'; live: 'ok' | 'error' } | { status: 'error' };

export type CookState = {
  list: CookListState;
  /** Plan 081: the kitchen's private orders of today (not cancelled), shown with the menu's. */
  privateOrders: Array<Order>;
  menu: CookMenu | null;
  /** Dishes made so far, from the server (shared by every device). */
  made: Record<string, number>;
  /** The parts Cook fetches itself: ready once the menu and the made counts are both in. */
  got: { menu: boolean; made: boolean };
};
/** Cook also reads the menu's orders from the Orders slice (plan 098 C5). */
export type CookRootState = { sellerCook: CookState } & KitchenOrdersRootState;

const initialState: CookState = {
  list: { status: 'loading' },
  privateOrders: [],
  menu: null,
  made: {},
  got: { menu: false, made: false },
};

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
    loaded(
      state,
      action: PayloadAction<{
        privateOrders?: Array<Order>;
        menu?: CookMenu;
        made?: Record<string, number>;
      }>,
    ) {
      // Plan 074: a live event reloads only the parts it touched, so each part is optional.
      // Keep the old objects when nothing changed, so memoised selectors do not recompute.
      if (
        action.payload.privateOrders &&
        JSON.stringify(state.privateOrders) !== JSON.stringify(action.payload.privateOrders)
      ) {
        state.privateOrders = action.payload.privateOrders;
      }
      if (
        action.payload.menu &&
        JSON.stringify(state.menu) !== JSON.stringify(action.payload.menu)
      ) {
        state.menu = action.payload.menu;
      }
      if (
        action.payload.made &&
        JSON.stringify(state.made) !== JSON.stringify(action.payload.made)
      ) {
        state.made = action.payload.made;
      }
      if (action.payload.menu) state.got.menu = true;
      if (action.payload.made) state.got.made = true;
      if (state.got.menu && state.got.made) state.list = { status: 'ready', live: 'ok' };
    },
    /** Made counts changed (this device's tap, or the server's answer). */
    madeReplaced(state, action: PayloadAction<Record<string, number>>) {
      state.made = action.payload;
    },
    loadFailed(state) {
      state.list =
        state.list.status === 'ready' ? { status: 'ready', live: 'error' } : { status: 'error' };
    },
  },
  extraReducers: (builder) => {
    // One order changed on this device (a tick or "Packed"): the menu's orders live in the Orders
    // slice (which patches itself); today's private ones are kept here.
    builder.addCase(orderPatched, (state, action) => {
      const index = state.privateOrders.findIndex((order) => order.id === action.payload.id);
      if (index >= 0) state.privateOrders[index] = action.payload;
    });
  },
});

export const {
  pollingStarted,
  pollingStopped,
  refreshRequested,
  loaded,
  loadFailed,
  madeReplaced,
} = cookSlice.actions;
export const cookReducer = cookSlice.reducer;
