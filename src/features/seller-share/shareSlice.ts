import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ShareMenu, ShareSettings } from './shareText';

export type ShareState = {
  status: 'loading' | 'ready' | 'error';
  menu: ShareMenu | null;
  settings: ShareSettings | null;
};
export type ShareRootState = { sellerShare: ShareState };

const initialState: ShareState = { status: 'loading', menu: null, settings: null };

const shareSlice = createSlice({
  name: 'sellerShare',
  initialState,
  reducers: {
    /** The screen dispatches this on mount and on retry. */
    loadRequested(state) {
      state.status = 'loading';
    },
    loaded(state, action: PayloadAction<{ menu: ShareMenu; settings: ShareSettings }>) {
      state.status = 'ready';
      state.menu = action.payload.menu;
      state.settings = action.payload.settings;
    },
    loadFailed(state) {
      state.status = 'error';
    },
  },
});

export const { loadRequested, loaded, loadFailed } = shareSlice.actions;
export const shareReducer = shareSlice.reducer;
