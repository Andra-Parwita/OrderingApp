import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Chef, SellerMenuItemView, Week } from '../../../shared/domain';
import type {
  CreateItemRequest,
  SavedSetView,
  UpdateItemRequest,
} from '../../../shared/setupContract';

/** Everything the menu editor can ask the server to do; the saga runs one at a time per request. */
export type MenuOp =
  | { kind: 'publish' }
  | { kind: 'unpublish' }
  | { kind: 'reorder'; ids: Array<string> }
  | { kind: 'createItem'; request: CreateItemRequest }
  | { kind: 'updateItem'; id: string; request: UpdateItemRequest }
  | { kind: 'deleteItem'; id: string }
  | { kind: 'useSet'; id: string; confirm: boolean }
  | { kind: 'saveSet'; name: string; replaceSetId?: string }
  | { kind: 'renameSet'; id: string; name: string }
  | { kind: 'deleteSet'; id: string }
  | { kind: 'addItems'; requests: Array<CreateItemRequest> };
export type MenuOpKind = MenuOp['kind'];

export type OpResult =
  | { kind: MenuOpKind; status: 'done'; count: number }
  | { kind: MenuOpKind; status: 'failed'; code: string; message: string; count: number };

export type MenuLoad = 'loading' | 'ready' | 'error';
export type MenuData = {
  kitchenName: string;
  week: Week;
  items: Array<SellerMenuItemView>;
  chefs: Array<Chef>;
  sets: Array<SavedSetView>;
};

export type MenuState = {
  load: MenuLoad;
  data: MenuData | null;
  /** A request is running; the buttons wait. */
  busy: boolean;
  result: OpResult | null;
  /** Bumps on every finished request, so a screen can tell its own answer from an old one. */
  seq: number;
};
export type MenuRootState = { sellerMenu: MenuState };

const initialState: MenuState = { load: 'loading', data: null, busy: false, result: null, seq: 0 };

const menuSlice = createSlice({
  name: 'sellerMenu',
  initialState,
  reducers: {
    /** The screens dispatch this on mount and on retry. */
    loadRequested(state) {
      if (state.load !== 'ready') state.load = 'loading';
    },
    loaded(state, action: PayloadAction<MenuData>) {
      state.load = 'ready';
      state.data = action.payload;
    },
    loadFailed(state) {
      if (state.load !== 'ready') state.load = 'error';
    },
    opRequested: {
      reducer(state) {
        state.busy = true;
      },
      prepare: (op: MenuOp) => ({ payload: op }),
    },
    opDone(state, action: PayloadAction<{ kind: MenuOpKind; count?: number }>) {
      state.busy = false;
      state.seq += 1;
      state.result = {
        kind: action.payload.kind,
        status: 'done',
        count: action.payload.count ?? 0,
      };
    },
    opFailed(
      state,
      action: PayloadAction<{ kind: MenuOpKind; code: string; message: string; count?: number }>,
    ) {
      state.busy = false;
      state.seq += 1;
      state.result = { status: 'failed', ...action.payload, count: action.payload.count ?? 0 };
    },
  },
});

export const { loadRequested, loaded, loadFailed, opRequested, opDone, opFailed } =
  menuSlice.actions;
export const menuReducer = menuSlice.reducer;
