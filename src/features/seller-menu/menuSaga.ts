import { all, call, put, takeEvery, takeLatest } from 'redux-saga/effects';
import {
  createItem,
  deleteItem,
  deleteSet,
  fetchSellerMenu,
  fetchSets,
  publishWeek,
  renameSet,
  reorderItems,
  saveSet,
  unpublishWeek,
  updateItem,
  useSet,
} from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import type { ApiResult } from '../../api/http';
import type { SellerMenuResponse } from '../../../shared/menuContract';
import type { SetsResponse } from '../../../shared/setupContract';
import { loaded, loadFailed, loadRequested, opDone, opFailed, opRequested } from './menuSlice';
import type { MenuOp } from './menuSlice';

type Outcome =
  { ok: true; count?: number } | { ok: false; code: string; message: string; count?: number };

function* fetchAll(quiet: boolean) {
  const slug = currentSellerSlug();
  const [menu, sets] = (yield all([
    call(fetchSellerMenu, undefined, slug),
    call(fetchSets, undefined, slug),
  ])) as [ApiResult<SellerMenuResponse>, ApiResult<SetsResponse>];
  if (menu.ok && sets.ok) {
    yield put(
      loaded({
        kitchenName: menu.data.kitchen.name,
        week: menu.data.week,
        items: menu.data.items,
        chefs: menu.data.chefs,
        sets: sets.data.sets,
      }),
    );
  } else if (!quiet) {
    yield put(loadFailed());
  }
}

function toOutcome(result: ApiResult<unknown>): Outcome {
  return result.ok ? { ok: true } : { ok: false, code: result.error, message: result.message };
}

function* execute(op: MenuOp) {
  const slug = currentSellerSlug();
  switch (op.kind) {
    case 'publish':
      return toOutcome((yield call(publishWeek, undefined, slug)) as ApiResult<unknown>);
    case 'unpublish':
      return toOutcome((yield call(unpublishWeek, undefined, slug)) as ApiResult<unknown>);
    case 'reorder':
      return toOutcome((yield call(reorderItems, op.ids, undefined, slug)) as ApiResult<unknown>);
    case 'createItem':
      return toOutcome((yield call(createItem, op.request, undefined, slug)) as ApiResult<unknown>);
    case 'updateItem':
      return toOutcome(
        (yield call(updateItem, op.id, op.request, undefined, slug)) as ApiResult<unknown>,
      );
    case 'deleteItem':
      return toOutcome((yield call(deleteItem, op.id, undefined, slug)) as ApiResult<unknown>);
    case 'useSet':
      return toOutcome(
        (yield call(
          useSet,
          op.id,
          op.confirm ? { confirm: true } : {},
          undefined,
          slug,
        )) as ApiResult<unknown>,
      );
    case 'saveSet':
      return toOutcome(
        (yield call(saveSet, op.name, op.replaceSetId, undefined, slug)) as ApiResult<unknown>,
      );
    case 'renameSet':
      return toOutcome(
        (yield call(renameSet, op.id, op.name, undefined, slug)) as ApiResult<unknown>,
      );
    case 'deleteSet':
      return toOutcome((yield call(deleteSet, op.id, undefined, slug)) as ApiResult<unknown>);
    case 'addItems': {
      let added = 0;
      for (const request of op.requests) {
        const result = (yield call(createItem, request, undefined, slug)) as ApiResult<unknown>;
        if (!result.ok)
          return { ok: false, code: result.error, message: result.message, count: added };
        added += 1;
      }
      return { ok: true, count: added };
    }
    default: {
      const unreachable: never = op;
      return unreachable;
    }
  }
}

export function* runOp(action: ReturnType<typeof opRequested>) {
  const op = action.payload;
  const outcome = (yield call(execute, op)) as Outcome;
  // Refresh first, so a screen that closes on success already shows the new menu.
  if (outcome.ok || (outcome.count ?? 0) > 0) yield call(fetchAll, true);
  if (outcome.ok)
    yield put(opDone({ kind: op.kind, ...(outcome.count ? { count: outcome.count } : {}) }));
  else
    yield put(
      opFailed({
        kind: op.kind,
        code: outcome.code,
        message: outcome.message,
        count: outcome.count,
      }),
    );
}

export function* menuSaga() {
  yield takeLatest(loadRequested.type, fetchAll, false);
  yield takeEvery(opRequested.type, runOp);
}
