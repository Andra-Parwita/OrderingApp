import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Chef, KitchenImages } from '../../../shared/domain';
import type { ImageSlot } from '../../../shared/imageSlots';
import type { ImageStyleRequest } from '../../../shared/setupContract';

export type Load = 'loading' | 'ready' | 'error';
export type Failure = { code: string; message: string };

export type SetupState = {
  images: {
    load: Load;
    data: KitchenImages;
    /** What is being saved right now: a slot, or the colour and text. */
    busy: ImageSlot | 'style' | null;
    /** The last refusal, and where it belongs. */
    failure: ({ target: ImageSlot | 'style' } & Failure) | null;
  };
  chefs: {
    load: Load;
    list: Array<Chef>;
    /** Items this week per chef id. */
    counts: Record<string, number>;
    kitchenName: string;
    busy: boolean;
    failure: Failure | null;
  };
  toast: 'saved' | null;
};
export type SetupRootState = { sellerSetup: SetupState };

const initialState: SetupState = {
  images: { load: 'loading', data: {}, busy: null, failure: null },
  chefs: { load: 'loading', list: [], counts: {}, kitchenName: '', busy: false, failure: null },
  toast: null,
};

const setupSlice = createSlice({
  name: 'sellerSetup',
  initialState,
  reducers: {
    // ---- images ----
    imagesRequested(state) {
      state.images.load = 'loading';
    },
    imagesLoaded(state, action: PayloadAction<KitchenImages>) {
      state.images.load = 'ready';
      state.images.data = action.payload;
    },
    imagesLoadFailed(state) {
      state.images.load = 'error';
    },
    uploadRequested(state, action: PayloadAction<{ slot: ImageSlot; dataUrl: string }>) {
      state.images.busy = action.payload.slot;
      state.images.failure = null;
    },
    removeRequested(state, action: PayloadAction<ImageSlot>) {
      state.images.busy = action.payload;
      state.images.failure = null;
    },
    styleRequested: {
      reducer(state) {
        state.images.busy = 'style';
        state.images.failure = null;
      },
      prepare: (payload: ImageStyleRequest) => ({ payload }),
    },
    imagesChanged(state, action: PayloadAction<KitchenImages>) {
      state.images.data = action.payload;
      state.images.busy = null;
    },
    imagesChangeFailed(state, action: PayloadAction<Failure>) {
      const target = state.images.busy ?? 'style';
      state.images.busy = null;
      state.images.failure = { target, ...action.payload };
    },
    styleSaved(state, action: PayloadAction<KitchenImages>) {
      state.images.data = action.payload;
      state.images.busy = null;
      state.toast = 'saved';
    },

    // ---- chefs ----
    chefsRequested(state) {
      state.chefs.load = 'loading';
    },
    chefsLoaded(
      state,
      action: PayloadAction<{
        chefs: Array<Chef>;
        counts: Record<string, number>;
        kitchen: string;
      }>,
    ) {
      state.chefs.load = 'ready';
      state.chefs.list = action.payload.chefs;
      state.chefs.counts = action.payload.counts;
      state.chefs.kitchenName = action.payload.kitchen;
      state.chefs.busy = false;
    },
    chefsLoadFailed(state) {
      state.chefs.load = 'error';
    },
    chefAddRequested: {
      reducer(state) {
        state.chefs.busy = true;
        state.chefs.failure = null;
      },
      prepare: (payload: string) => ({ payload }),
    },
    chefRenameRequested: {
      reducer(state) {
        state.chefs.busy = true;
        state.chefs.failure = null;
      },
      prepare: (payload: { id: string; name: string }) => ({ payload }),
    },
    chefDeleteRequested: {
      reducer(state) {
        state.chefs.busy = true;
        state.chefs.failure = null;
      },
      prepare: (payload: string) => ({ payload }),
    },
    chefChangeFailed(state, action: PayloadAction<Failure>) {
      state.chefs.busy = false;
      state.chefs.failure = action.payload;
    },

    toastDismissed(state) {
      state.toast = null;
    },
  },
});

export const {
  imagesRequested,
  imagesLoaded,
  imagesLoadFailed,
  uploadRequested,
  removeRequested,
  styleRequested,
  imagesChanged,
  imagesChangeFailed,
  styleSaved,
  chefsRequested,
  chefsLoaded,
  chefsLoadFailed,
  chefAddRequested,
  chefRenameRequested,
  chefDeleteRequested,
  chefChangeFailed,
  toastDismissed,
} = setupSlice.actions;
export const setupReducer = setupSlice.reducer;
