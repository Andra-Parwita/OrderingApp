import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { KitchenSettings } from '../../../shared/domain';

export type SaveState =
  { status: 'idle' } | { status: 'saving' } | { status: 'error'; code: string; message: string };

export type SettingsState = {
  load: 'loading' | 'ready' | 'error';
  settings: KitchenSettings | null;
  /** ISO instant of this week's cut-off, for the "closes automatically" line. */
  cutoffAt: string | null;
  /** Bumps on every load and save, so the form starts afresh from the server's values. */
  version: number;
  save: SaveState;
  toast: 'saved' | null;
};
export type SettingsRootState = { sellerSettings: SettingsState };

const initialState: SettingsState = {
  load: 'loading',
  settings: null,
  cutoffAt: null,
  version: 0,
  save: { status: 'idle' },
  toast: null,
};

const settingsSlice = createSlice({
  name: 'sellerSettings',
  initialState,
  reducers: {
    /** The screen dispatches this on mount and on retry. */
    loadRequested(state) {
      state.load = 'loading';
    },
    loaded(state, action: PayloadAction<{ settings: KitchenSettings; cutoffAt: string }>) {
      state.load = 'ready';
      state.version += 1;
      state.settings = action.payload.settings;
      state.cutoffAt = action.payload.cutoffAt;
    },
    loadFailed(state) {
      state.load = 'error';
    },
    saveRequested: {
      reducer(state) {
        state.save = { status: 'saving' };
      },
      prepare: (payload: KitchenSettings) => ({ payload }),
    },
    saved(state, action: PayloadAction<{ settings: KitchenSettings }>) {
      state.settings = action.payload.settings;
      state.version += 1;
      state.save = { status: 'idle' };
      state.toast = 'saved';
    },
    saveFailed(state, action: PayloadAction<{ code: string; message: string }>) {
      state.save = { status: 'error', ...action.payload };
    },
    toastDismissed(state) {
      state.toast = null;
    },
  },
});

export const {
  loadRequested,
  loaded,
  loadFailed,
  saveRequested,
  saved,
  saveFailed,
  toastDismissed,
} = settingsSlice.actions;
export const settingsReducer = settingsSlice.reducer;
