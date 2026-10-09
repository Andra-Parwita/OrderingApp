import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ApiWarning } from '../../../shared/apiError';
import type { Chef } from '../../../shared/domain';
import type {
  CreateDishRequest,
  Dish,
  DishSet,
  MenuView,
  PickupPlace,
  Preferences,
  UpdateDishRequest,
  UpdateMenuRequest,
  UpdatePickupPlaceRequest,
} from '../../../shared/menusContract';
import type { PastWeekSummary } from '../../../shared/pastWeeks';
import type { PickupPointInput, UpdateItemRequest } from '../../../shared/setupContract';

/** Everything the menu screens can ask the server to do; the saga runs each and then refreshes. */
export type MenuOp =
  | { kind: 'createMenu'; cookingDate: string }
  | { kind: 'updateMenu'; request: UpdateMenuRequest }
  | { kind: 'publish'; force?: boolean }
  | { kind: 'unpublish' }
  | { kind: 'deleteMenu' }
  | { kind: 'finish' }
  | { kind: 'uploadPicture'; dataUrl: string }
  | { kind: 'removePicture' }
  /** `alsoDishId`: the library dish behind it, kept in step (name, description, size, price, limit, chef). */
  | { kind: 'updateMenuDish'; id: string; request: UpdateItemRequest; alsoDishId?: string }
  | { kind: 'createDish'; request: CreateDishRequest; addToMenu: boolean }
  | { kind: 'updateDish'; id: string; request: UpdateDishRequest }
  | { kind: 'deleteDish'; id: string }
  | { kind: 'createSet'; name: string; dishIds: Array<string> }
  | { kind: 'useSet'; setId: string }
  | { kind: 'usePast'; weekId: string }
  | { kind: 'createPlace'; request: PickupPointInput }
  | { kind: 'updatePlace'; id: string; request: UpdatePickupPlaceRequest }
  | { kind: 'deletePlace'; id: string };
export type MenuOpKind = MenuOp['kind'];

export type OpResult =
  | {
      kind: MenuOpKind;
      status: 'done';
      /** createDish: the new library dish; deleteDish / deletePlace: it was on the live menu. */
      dishId?: string;
      usedOnLiveMenu?: boolean;
      /** usePast: how many dishes were added, and how many were no longer in Your dishes. */
      added?: number;
      missing?: number;
      /** updateMenu: names of dishes dropped although they have orders (D-062). */
      removedWithOrders?: number;
    }
  | {
      kind: MenuOpKind;
      status: 'failed';
      code: string;
      message: string;
      warning?: ApiWarning;
    };

export type MenuLoad = 'loading' | 'ready' | 'error';
export type MenuData = {
  view: MenuView;
  dishes: Array<Dish>;
  sets: Array<DishSet>;
  places: Array<PickupPlace>;
  chefs: Array<Chef>;
  prefs: Preferences;
  /** Past menus, newest first. */
  past: Array<PastWeekSummary>;
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

type DoneExtras = Partial<Omit<Extract<OpResult, { status: 'done' }>, 'kind' | 'status'>>;

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
    opDone(state, action: PayloadAction<{ kind: MenuOpKind } & DoneExtras>) {
      state.busy = false;
      state.seq += 1;
      state.result = { status: 'done', ...action.payload };
    },
    opFailed(
      state,
      action: PayloadAction<{
        kind: MenuOpKind;
        code: string;
        message: string;
        warning?: ApiWarning;
      }>,
    ) {
      state.busy = false;
      state.seq += 1;
      state.result = { status: 'failed', ...action.payload };
    },
  },
});

export const { loadRequested, loaded, loadFailed, opRequested, opDone, opFailed } =
  menuSlice.actions;
export const menuReducer = menuSlice.reducer;
