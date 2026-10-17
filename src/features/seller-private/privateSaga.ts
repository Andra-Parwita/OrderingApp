import type { EventChannel } from 'redux-saga';
import { all, call, put, race, select, take, takeEvery, takeLatest } from 'redux-saga/effects';
import { sellerBackupMs } from '../../api/backupMinutes';
import { fetchSellerOrder, setOrderStatus } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import type { ApiResult } from '../../api/http';
import { liveRefreshLoop, type Changed, type LiveMessage } from '../../api/live';
import { cancelPrivate, createPrivate, fetchPrivate, updatePrivate } from '../../api/private';
import { staffSignedOut } from '../../api/staffSignedOut';
import type { SellerOrderResponse } from '../../../shared/orderContract';
import type { CreatePrivateRequest, PrivateListResponse } from '../../../shared/privateContract';
import {
  actionFailed,
  cancelRequested,
  detailOpened,
  listOpened,
  loaded,
  loadFailed,
  orderSaved,
  pollingStarted,
  pollingStopped,
  refreshRequested,
  saveRequested,
  statusRequested,
  viewChanged,
  type PrivateRootState,
  type PrivateState,
} from './privateSlice';

const selectPrivate = (state: PrivateRootState): PrivateState => state.sellerPrivate;

/**
 * One load: the list when its screen is open (else only the today / tomorrow counts for More), and
 * the open order. A live `order.*` event reloads it; no event (first load, reconnect, backup check)
 * reloads it too.
 */
export function* loadPrivate(changed: Changed) {
  const wanted = changed === null || changed.has('order.created') || changed.has('order.changed');
  if (!wanted) return;
  const { listOpen, view, detailCode } = (yield select(selectPrivate)) as PrivateState;
  const slug = currentSellerSlug();
  const [list, detail] = (yield all([
    call(fetchPrivate, listOpen ? { view } : { dueOnly: true }, slug),
    detailCode ? call(fetchSellerOrder, detailCode, undefined, slug) : null,
  ])) as [ApiResult<PrivateListResponse>, ApiResult<SellerOrderResponse> | null];
  if (!list.ok || (detail && !detail.ok)) {
    yield put(loadFailed());
    return;
  }
  yield put(
    loaded({
      due: list.data.due,
      today: list.data.today,
      ...(listOpen ? { orders: { view, list: list.data.orders } } : {}),
      ...(detail?.ok ? { detail: detail.data.order } : {}),
    }),
  );
}

function* loadNow() {
  yield call(loadPrivate, null);
}

type Kind = 'save' | 'cancel' | 'status';

function* finish(kind: Kind, result: ApiResult<SellerOrderResponse>) {
  if (!result.ok) {
    yield put(actionFailed({ kind, code: result.error }));
    return;
  }
  yield put(orderSaved({ kind, order: result.data.order }));
  // The counts on More and the list's grouping follow the change.
  yield call(loadPrivate, null);
}

function* save(action: ReturnType<typeof saveRequested>) {
  const { code, request } = action.payload;
  const slug = currentSellerSlug();
  const result = (yield code === null
    ? call(createPrivate, request as CreatePrivateRequest, slug)
    : call(updatePrivate, code, request, slug)) as ApiResult<SellerOrderResponse>;
  yield call(finish, 'save', result);
}

function* cancel(action: ReturnType<typeof cancelRequested>) {
  const result = (yield call(
    cancelPrivate,
    action.payload.code,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  yield call(finish, 'cancel', result);
}

function* moveStatus(action: ReturnType<typeof statusRequested>) {
  const { code, to } = action.payload;
  const result = (yield call(
    setOrderStatus,
    code,
    to,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  yield call(finish, 'status', result);
}

// Live updates (plan 074): reload when the seller's Durable Object reports an order change; every
// `pollMs` while the socket is down. Runs while the shell or a Private screen has asked for it.
function* watchPolling(pollMs: number | (() => number), channel?: () => EventChannel<LiveMessage>) {
  while (true) {
    yield take(pollingStarted.type);
    yield race({
      poll: call(liveRefreshLoop, {
        load: loadPrivate,
        fallbackMs: pollMs,
        ...(channel ? { channel } : {}),
      }),
      stop: take([pollingStopped.type, staffSignedOut.type]),
    });
  }
}

export function* privateSaga(
  pollMs: number | (() => number) = sellerBackupMs,
  channel?: () => EventChannel<LiveMessage>,
) {
  yield takeLatest(
    [refreshRequested.type, viewChanged.type, listOpened.type, detailOpened.type],
    loadNow,
  );
  yield takeEvery(saveRequested.type, save);
  yield takeEvery(cancelRequested.type, cancel);
  yield takeEvery(statusRequested.type, moveStatus);
  yield call(watchPolling, pollMs, channel);
}
