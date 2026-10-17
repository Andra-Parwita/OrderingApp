import { all, call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import { fetchChefs, fetchCurrentMenu, fetchPastWeeks, updateItem } from '../../api/client';
import { noteCurrentMenu } from '../../api/cachedReads';
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
  removeDishPicture,
  removeMenuPicture,
  unpublishMenu,
  usePastMenuPicture,
  addDishToMenu,
  updateCurrentMenu,
  updateDish,
  updatePickupPlace,
  uploadDishPicture,
  uploadMenuPicture,
} from '../../api/menus';
import { MAX_MENU_ITEMS } from '../../../shared/limits';
import type { ApiWarning } from '../../../shared/apiError';
import type { ChefsResponse } from '../../../shared/setupContract';
import type {
  DishesResponse,
  DishResponse,
  UpdateMenuResponse,
  DishSetsResponse,
  MenuView,
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
  patched,
  type MenuData,
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
type Part = 'view' | 'dishes' | 'sets' | 'places' | 'past';
type Outcome =
  | { ok: true; done: Done; patch?: Partial<MenuData>; reload?: Array<Part> }
  | { ok: false; code: string; message: string; warning?: ApiWarning; patch?: Partial<MenuData> };

/** Plan 073: what an op can change. After a failure all of it is re-read, as before. */
const PARTS: Record<MenuOp['kind'], Array<Part>> = {
  createMenu: ['view'],
  updateMenu: ['view'],
  publish: ['view'],
  unpublish: ['view'],
  deleteMenu: ['view'],
  finish: ['view', 'past'],
  uploadPicture: ['view'],
  usePastPicture: ['view'],
  removePicture: ['view'],
  updateMenuDish: ['view', 'dishes'],
  createDish: ['view', 'dishes'],
  updateDish: ['view', 'dishes'],
  deleteDish: ['view', 'dishes', 'sets'],
  uploadDishPicture: ['view', 'dishes'],
  removeDishPicture: ['view', 'dishes'],
  addDishToMenu: ['view'],
  createSet: ['sets'],
  useSet: ['view'],
  usePast: ['view'],
  createPlace: ['view', 'places'],
  updatePlace: ['view', 'places'],
  deletePlace: ['view', 'places'],
};

/** Re-read only these parts of the wizard's data (one GET each). */
function* reloadParts(parts: Array<Part>) {
  if (parts.length === 0) return;
  const slug = currentSellerSlug();
  const calls: Record<Part, () => unknown> = {
    view: () => call(fetchCurrentMenu, undefined, slug),
    dishes: () => call(fetchDishes, undefined, slug),
    sets: () => call(fetchSavedSets, undefined, slug),
    places: () => call(fetchPickupPlaces, undefined, slug),
    past: () => call(fetchPastWeeks, undefined, slug),
  };
  const results = (yield all(parts.map((part) => calls[part]()))) as Array<ApiResult<unknown>>;
  const patch: Partial<MenuData> = {};
  let failed = false;
  parts.forEach((part, index) => {
    const result = results[index];
    if (!result?.ok) {
      failed = true;
      return;
    }
    const data = result.data as Record<string, never>;
    if (part === 'view') {
      patch.view = (data as unknown as MenuViewResponse).menu;
      noteCurrentMenu(patch.view);
    } else if (part === 'dishes') patch.dishes = (data as unknown as DishesResponse).dishes;
    else if (part === 'sets') patch.sets = (data as unknown as DishSetsResponse).sets;
    else if (part === 'places') patch.places = (data as unknown as PickupPlacesResponse).places;
    else
      patch.past = [...(data as unknown as PastWeeksResponse).weeks].sort((a, b) =>
        b.cookingDate.localeCompare(a.cookingDate),
      );
  });
  if (!failed || Object.keys(patch).length > 0) yield put(patched(patch));
}

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

/** An answer that carries the new menu view: it goes straight into the slice, nothing is re-read. */
function viewOutcome(
  result: ApiResult<{ menu: MenuView }>,
  done: Done = {},
  reload: Array<Part> = [],
): Outcome {
  const outcome = toOutcome(result, done);
  if (!outcome.ok || !result.ok) return outcome;
  return { ...outcome, patch: { view: result.data.menu }, reload };
}

function* currentData() {
  return (yield select(
    (state: MenuRootState) => state.sellerMenu.data,
  )) as MenuRootState['sellerMenu']['data'];
}

/** Each op sends its request; the answer (or a small re-read) updates only what it changed. */
function* execute(op: MenuOp) {
  const slug = currentSellerSlug();
  switch (op.kind) {
    case 'createMenu':
      return viewOutcome(
        (yield call(
          createMenu,
          op.cookingDate,
          undefined,
          slug,
          op.pictureFromPastMenu,
        )) as ApiResult<MenuViewResponse>,
      );
    case 'updateMenu': {
      const result = (yield call(updateCurrentMenu, op.request, undefined, slug)) as Awaited<
        ReturnType<typeof updateCurrentMenu>
      >;
      return viewOutcome(result, {
        removedWithOrders: result.ok ? result.data.warnings.removedWithOrders.length : 0,
      });
    }
    case 'publish':
      return viewOutcome(
        (yield call(
          publishMenu,
          op.force,
          undefined,
          slug,
          op.takingOrders,
        )) as ApiResult<MenuViewResponse>,
      );
    case 'unpublish':
      return viewOutcome(
        (yield call(unpublishMenu, undefined, slug)) as ApiResult<MenuViewResponse>,
      );
    case 'deleteMenu':
      return viewOutcome((yield call(deleteMenu, undefined, slug)) as ApiResult<MenuViewResponse>);
    case 'finish':
      return viewOutcome(
        (yield call(finishMenu, undefined, slug)) as Awaited<ReturnType<typeof finishMenu>>,
        {},
        ['past'],
      );
    case 'uploadPicture':
      return viewOutcome(
        (yield call(uploadMenuPicture, op.dataUrl, undefined, slug)) as ApiResult<MenuViewResponse>,
      );
    case 'usePastPicture':
      return viewOutcome(
        (yield call(
          usePastMenuPicture,
          op.pastMenuId,
          undefined,
          slug,
        )) as ApiResult<MenuViewResponse>,
      );
    case 'removePicture':
      return viewOutcome(
        (yield call(removeMenuPicture, undefined, slug)) as ApiResult<MenuViewResponse>,
      );
    case 'updateMenuDish': {
      const result = (yield call(
        updateItem,
        op.id,
        op.request,
        undefined,
        slug,
      )) as ApiResult<unknown>;
      if (!result.ok) return toOutcome(result);
      // The answer is the item, not the menu: the menu is read again (1 GET).
      if (op.alsoDishId === undefined)
        return { ok: true, done: {}, reload: ['view'] } satisfies Outcome;
      const dishPatch = { ...op.request };
      delete dishPatch.soldOut;
      const also = (yield call(
        updateDish,
        op.alsoDishId,
        dishPatch,
        undefined,
        slug,
      )) as ApiResult<DishResponse>;
      const data = yield* currentData();
      if (also.ok && data) {
        const dish = also.data.dish;
        return {
          ok: true,
          done: {},
          reload: ['view'],
          patch: { dishes: data.dishes.map((d) => (d.id === dish.id ? dish : d)) },
        } satisfies Outcome;
      }
      return { ok: true, done: {}, reload: ['view', 'dishes'] } satisfies Outcome;
    }
    case 'createDish': {
      const created = (yield call(createDish, op.request, undefined, slug)) as Awaited<
        ReturnType<typeof createDish>
      >;
      if (!created.ok) return toOutcome(created);
      const dishId = created.data.dish.id;
      // The library's order is the server's, so the library is read again (1 GET).
      if (!op.addToMenu)
        return { ok: true, done: { dishId }, reload: ['dishes'] } satisfies Outcome;
      const added = (yield call(
        addDishToMenu,
        dishId,
        undefined,
        slug,
      )) as ApiResult<MenuViewResponse>;
      // The dish is saved either way; a refused add (the menu is full) is told to the screen.
      if (!added.ok) return { ok: false, code: added.error, message: added.message } as Outcome;
      return {
        ok: true,
        done: { dishId },
        patch: { view: added.data.menu },
        reload: ['dishes'],
      } satisfies Outcome;
    }
    case 'updateDish': {
      const result = (yield call(
        updateDish,
        op.id,
        op.request,
        undefined,
        slug,
      )) as ApiResult<DishResponse>;
      if (!result.ok) return toOutcome(result);
      // The menu holds a copy: its name, description and size follow (price and limit stay per menu).
      const data = yield* currentData();
      const copy = data?.view.dishes.find((dish) => dish.dishId === op.id);
      const { name, description, size } = op.request;
      const follows = Boolean(copy && (name || description || size));
      if (copy && follows) {
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
      const dish = result.data.dish;
      return {
        ok: true,
        done: {},
        reload: follows ? ['view'] : [],
        patch: data ? { dishes: data.dishes.map((d) => (d.id === dish.id ? dish : d)) } : {},
      } satisfies Outcome;
    }
    case 'addDishToMenu': {
      const data = yield* currentData();
      const onMenu = (data?.view.dishes ?? []).flatMap((dish) =>
        dish.dishId ? [dish.dishId] : [],
      );
      if (onMenu.includes(op.dishId)) return { ok: true, done: {} } satisfies Outcome;
      return viewOutcome(
        (yield call(addDishToMenu, op.dishId, undefined, slug)) as ApiResult<MenuViewResponse>,
      );
    }
    case 'deleteDish': {
      const result = (yield call(deleteDish, op.id, undefined, slug)) as Awaited<
        ReturnType<typeof deleteDish>
      >;
      const outcome = toOutcome(result, {
        usedOnLiveMenu: result.ok ? result.data.usedOnLiveMenu : false,
      });
      // The menu copy and the sets that held the dish are read again.
      return outcome.ok ? { ...outcome, reload: ['view', 'dishes', 'sets'] } : outcome;
    }
    case 'uploadDishPicture':
    case 'removeDishPicture': {
      const result = (yield op.kind === 'uploadDishPicture'
        ? call(uploadDishPicture, op.id, op.dataUrl, undefined, slug)
        : call(removeDishPicture, op.id, undefined, slug)) as ApiResult<DishResponse>;
      if (!result.ok) return toOutcome(result);
      // The menu holds a copy of the picture too: the dish list gets the answer, the menu is read again.
      const data = yield* currentData();
      const dish = result.data.dish;
      return {
        ok: true,
        done: {},
        reload: ['view'],
        patch: data ? { dishes: data.dishes.map((d) => (d.id === dish.id ? dish : d)) } : {},
      } satisfies Outcome;
    }
    case 'createSet': {
      const outcome = toOutcome(
        (yield call(
          createSavedSet,
          { name: op.name, dishIds: op.dishIds },
          undefined,
          slug,
        )) as ApiResult<unknown>,
      );
      return outcome.ok ? { ...outcome, reload: ['sets'] } : outcome;
    }
    case 'useSet': {
      const data = yield* currentData();
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
      )) as ApiResult<UpdateMenuResponse>;
      return viewOutcome(result, { added: next.length - onMenu.length });
    }
    case 'usePast': {
      // Past menus keep dish names, not library ids: match them to Your dishes by name.
      const data = yield* currentData();
      const week = data?.past.find((candidate) => candidate.id === op.weekId);
      if (!data || !week)
        return { ok: false, code: 'not_found', message: 'Menu not found' } as Outcome;
      const onMenu = data.view.dishes.flatMap((dish) => (dish.dishId ? [dish.dishId] : []));
      const { ids, missing } = matchPastDishes(week.totals.items, data.dishes);
      const next = [...onMenu, ...ids.filter((id) => !onMenu.includes(id))].slice(
        0,
        MAX_MENU_ITEMS,
      );
      const result = (yield call(
        updateCurrentMenu,
        { dishIds: next },
        undefined,
        slug,
      )) as ApiResult<UpdateMenuResponse>;
      return viewOutcome(result, { added: next.length - onMenu.length, missing });
    }
    case 'createPlace':
      return placeOutcome(
        (yield call(createPickupPlace, op.request, undefined, slug)) as ApiResult<unknown>,
      );
    case 'updatePlace':
      return placeOutcome(
        (yield call(updatePickupPlace, op.id, op.request, undefined, slug)) as ApiResult<unknown>,
      );
    case 'deletePlace': {
      const result = (yield call(deletePickupPlaceCall, op.id, slug)) as Awaited<
        ReturnType<typeof deletePickupPlace>
      >;
      return placeOutcome(result, {
        usedOnLiveMenu: result.ok ? result.data.usedOnLiveMenu : false,
      });
    }
    default: {
      const unreachable: never = op;
      return unreachable;
    }
  }
}

/** A place answer is the place, not the list: the places and the menu's copy are read again. */
function placeOutcome(result: ApiResult<unknown>, done: Done = {}): Outcome {
  const outcome = toOutcome(result, done);
  return outcome.ok ? { ...outcome, reload: ['places', 'view'] } : outcome;
}

function deletePickupPlaceCall(id: string, slug: string) {
  return deletePickupPlace(id, undefined, slug);
}

export function* runOp(action: ReturnType<typeof opRequested>) {
  const op = action.payload;
  const ref = 'ref' in op && op.ref !== undefined ? { ref: op.ref } : {};
  const outcome = (yield call(execute, op)) as Outcome;
  // Refresh first, so a screen that closes on success already shows the new menu. The answer's own
  // data goes in as it is; only what the answer cannot carry is read again. A failure (or a
  // partial success: the dish was created, the add was refused) re-reads all the op can change.
  if (outcome.patch) yield put(patched(outcome.patch));
  if (outcome.patch?.view) noteCurrentMenu(outcome.patch.view);
  const reload = outcome.ok ? (outcome.reload ?? []) : PARTS[op.kind];
  yield call(reloadParts, reload);
  if (outcome.ok) yield put(opDone({ kind: op.kind, ...ref, ...outcome.done }));
  else
    yield put(
      opFailed({
        kind: op.kind,
        ...ref,
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
