import { all, call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import { fetchChefs, fetchCurrentMenu, fetchPastWeeks, updateItem } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import type { ApiResult } from '../../api/http';
import {
  createDish,
  createMenu,
  createPickupPlace,
  createSavedSet,
  deleteDish,
  deleteMenu,
  deletePickupPlace,
  fetchDishes,
  fetchPickupPlaces,
  fetchPreferences,
  fetchSavedSets,
  finishMenu,
  publishMenu,
  removeMenuPicture,
  unpublishMenu,
  updateCurrentMenu,
  updateDish,
  updatePickupPlace,
  uploadMenuPicture,
} from '../../api/menus';
import type { ApiWarning } from '../../../shared/apiError';
import type { ChefsResponse } from '../../../shared/setupContract';
import type {
  DishesResponse,
  DishSetsResponse,
  MenuViewResponse,
  PickupPlacesResponse,
  PreferencesResponse,
} from '../../../shared/menusContract';
import type { PastWeeksResponse } from '../../../shared/pastWeeks';
import { matchPastDishes } from './pastMenus';
import {
  loaded,
  loadFailed,
  loadRequested,
  opDone,
  opFailed,
  opRequested,
  type MenuOp,
  type MenuRootState,
} from './menuSlice';

type Done = {
  dishId?: string;
  usedOnLiveMenu?: boolean;
  added?: number;
  missing?: number;
  removedWithOrders?: number;
};
type Outcome =
  { ok: true; done: Done } | { ok: false; code: string; message: string; warning?: ApiWarning };

function* fetchAll(quiet: boolean) {
  const slug = currentSellerSlug();
  const [menu, dishes, sets, places, chefs, prefs, past] = (yield all([
    call(fetchCurrentMenu, undefined, slug),
    call(fetchDishes, undefined, slug),
    call(fetchSavedSets, undefined, slug),
    call(fetchPickupPlaces, undefined, slug),
    call(fetchChefs, undefined, slug),
    call(fetchPreferences, undefined, slug),
    call(fetchPastWeeks, undefined, slug),
  ])) as [
    ApiResult<MenuViewResponse>,
    ApiResult<DishesResponse>,
    ApiResult<DishSetsResponse>,
    ApiResult<PickupPlacesResponse>,
    ApiResult<ChefsResponse>,
    ApiResult<PreferencesResponse>,
    ApiResult<PastWeeksResponse>,
  ];
  if (menu.ok && dishes.ok && sets.ok && places.ok && chefs.ok && prefs.ok && past.ok) {
    yield put(
      loaded({
        view: menu.data.menu,
        dishes: dishes.data.dishes,
        sets: sets.data.sets,
        places: places.data.places,
        chefs: chefs.data.chefs,
        prefs: prefs.data.preferences,
        past: [...past.data.weeks].sort((a, b) => b.cookingDate.localeCompare(a.cookingDate)),
      }),
    );
  } else if (!quiet) {
    yield put(loadFailed());
  }
}

function toOutcome(result: ApiResult<unknown>, done: Done = {}): Outcome {
  return result.ok
    ? { ok: true, done }
    : {
        ok: false,
        code: result.error,
        message: result.message,
        ...(result.warning ? { warning: result.warning } : {}),
      };
}

/** The library dish ids on the menu now, in order, plus the ones to add (up to the limit). */
function* execute(op: MenuOp) {
  const slug = currentSellerSlug();
  switch (op.kind) {
    case 'createMenu':
      return toOutcome(
        (yield call(createMenu, op.cookingDate, undefined, slug)) as ApiResult<unknown>,
      );
    case 'updateMenu': {
      const result = (yield call(updateCurrentMenu, op.request, undefined, slug)) as Awaited<
        ReturnType<typeof updateCurrentMenu>
      >;
      return toOutcome(result, {
        removedWithOrders: result.ok ? result.data.warnings.removedWithOrders.length : 0,
      });
    }
    case 'publish':
      return toOutcome((yield call(publishMenu, op.force, undefined, slug)) as ApiResult<unknown>);
    case 'unpublish':
      return toOutcome((yield call(unpublishMenu, undefined, slug)) as ApiResult<unknown>);
    case 'deleteMenu':
      return toOutcome((yield call(deleteMenu, undefined, slug)) as ApiResult<unknown>);
    case 'finish':
      return toOutcome((yield call(finishMenu, undefined, slug)) as ApiResult<unknown>);
    case 'uploadPicture':
      return toOutcome(
        (yield call(uploadMenuPicture, op.dataUrl, undefined, slug)) as ApiResult<unknown>,
      );
    case 'removePicture':
      return toOutcome((yield call(removeMenuPicture, undefined, slug)) as ApiResult<unknown>);
    case 'updateMenuDish': {
      const result = (yield call(
        updateItem,
        op.id,
        op.request,
        undefined,
        slug,
      )) as ApiResult<unknown>;
      if (result.ok && op.alsoDishId !== undefined) {
        const dishPatch = { ...op.request };
        delete dishPatch.soldOut;
        yield call(updateDish, op.alsoDishId, dishPatch, undefined, slug);
      }
      return toOutcome(result);
    }
    case 'createDish': {
      const created = (yield call(createDish, op.request, undefined, slug)) as Awaited<
        ReturnType<typeof createDish>
      >;
      if (!created.ok) return toOutcome(created);
      const dishId = created.data.dish.id;
      if (op.addToMenu) {
        const data = (yield select(
          (state: MenuRootState) => state.sellerMenu.data,
        )) as MenuRootState['sellerMenu']['data'];
        const onMenu = (data?.view.dishes ?? []).flatMap((dish) =>
          dish.dishId ? [dish.dishId] : [],
        );
        const added = (yield call(
          updateCurrentMenu,
          { dishIds: [...onMenu, dishId] },
          undefined,
          slug,
        )) as ApiResult<unknown>;
        // The dish is saved either way; a refused add (the menu is full) is told to the screen.
        if (!added.ok) return { ok: false, code: added.error, message: added.message } as Outcome;
      }
      return { ok: true, done: { dishId } } satisfies Outcome;
    }
    case 'updateDish': {
      const result = (yield call(
        updateDish,
        op.id,
        op.request,
        undefined,
        slug,
      )) as ApiResult<unknown>;
      if (result.ok) {
        // The menu holds a copy: its name, description and size follow (price and limit stay per menu).
        const data = (yield select(
          (state: MenuRootState) => state.sellerMenu.data,
        )) as MenuRootState['sellerMenu']['data'];
        const copy = data?.view.dishes.find((dish) => dish.dishId === op.id);
        const { name, description, size } = op.request;
        if (copy && (name || description || size)) {
          yield call(
            updateItem,
            copy.id,
            {
              ...(name ? { name } : {}),
              ...(description ? { description } : {}),
              ...(size ? { size } : {}),
            },
            undefined,
            slug,
          );
        }
      }
      return toOutcome(result);
    }
    case 'deleteDish': {
      const result = (yield call(deleteDish, op.id, undefined, slug)) as Awaited<
        ReturnType<typeof deleteDish>
      >;
      return toOutcome(result, { usedOnLiveMenu: result.ok ? result.data.usedOnLiveMenu : false });
    }
    case 'createSet':
      return toOutcome(
        (yield call(
          createSavedSet,
          { name: op.name, dishIds: op.dishIds },
          undefined,
          slug,
        )) as ApiResult<unknown>,
      );
    case 'useSet': {
      const data = (yield select(
        (state: MenuRootState) => state.sellerMenu.data,
      )) as MenuRootState['sellerMenu']['data'];
      const set = data?.sets.find((candidate) => candidate.id === op.setId);
      if (!data || !set)
        return { ok: false, code: 'not_found', message: 'Set not found' } as Outcome;
      const onMenu = data.view.dishes.flatMap((dish) => (dish.dishId ? [dish.dishId] : []));
      const next = [...onMenu, ...set.dishIds.filter((id) => !onMenu.includes(id))];
      const result = (yield call(
        updateCurrentMenu,
        { dishIds: next },
        undefined,
        slug,
      )) as ApiResult<unknown>;
      return toOutcome(result, { added: next.length - onMenu.length });
    }
    case 'usePast': {
      // Past menus keep dish names, not library ids: match them to Your dishes by name.
      const data = (yield select(
        (state: MenuRootState) => state.sellerMenu.data,
      )) as MenuRootState['sellerMenu']['data'];
      const week = data?.past.find((candidate) => candidate.id === op.weekId);
      if (!data || !week)
        return { ok: false, code: 'not_found', message: 'Menu not found' } as Outcome;
      const onMenu = data.view.dishes.flatMap((dish) => (dish.dishId ? [dish.dishId] : []));
      const { ids, missing } = matchPastDishes(week.totals.items, data.dishes);
      const next = [...onMenu, ...ids.filter((id) => !onMenu.includes(id))].slice(0, 10);
      const result = (yield call(
        updateCurrentMenu,
        { dishIds: next },
        undefined,
        slug,
      )) as ApiResult<unknown>;
      return toOutcome(result, { added: next.length - onMenu.length, missing });
    }
    case 'createPlace':
      return toOutcome(
        (yield call(createPickupPlace, op.request, undefined, slug)) as ApiResult<unknown>,
      );
    case 'updatePlace':
      return toOutcome(
        (yield call(updatePickupPlace, op.id, op.request, undefined, slug)) as ApiResult<unknown>,
      );
    case 'deletePlace': {
      const result = (yield call(deletePickupPlaceCall, op.id, slug)) as Awaited<
        ReturnType<typeof deletePickupPlace>
      >;
      return toOutcome(result, { usedOnLiveMenu: result.ok ? result.data.usedOnLiveMenu : false });
    }
    default: {
      const unreachable: never = op;
      return unreachable;
    }
  }
}

function deletePickupPlaceCall(id: string, slug: string) {
  return deletePickupPlace(id, undefined, slug);
}

export function* runOp(action: ReturnType<typeof opRequested>) {
  const op = action.payload;
  const outcome = (yield call(execute, op)) as Outcome;
  // Refresh first, so a screen that closes on success already shows the new menu. A partial
  // success (the dish was created, the add was refused) refreshes too.
  yield call(fetchAll, true);
  if (outcome.ok) yield put(opDone({ kind: op.kind, ...outcome.done }));
  else
    yield put(
      opFailed({
        kind: op.kind,
        code: outcome.code,
        message: outcome.message,
        ...(outcome.warning ? { warning: outcome.warning } : {}),
      }),
    );
}

export function* menuSaga() {
  yield takeLatest(loadRequested.type, fetchAll, false);
  yield takeEvery(opRequested.type, runOp);
}
