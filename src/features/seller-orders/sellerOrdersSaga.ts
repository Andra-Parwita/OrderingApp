import { call, put, race, take, takeEvery, takeLatest, takeLeading } from 'redux-saga/effects';
import { devResetRequested, devSampleOrdersRequested } from './devActions';
import type { ApiResult } from '../../api/http';
import {
  addSampleOrders,
  createSellerOrder,
  fetchMenu,
  fetchSellerMenu,
  fetchSellerOrders,
  markOrderSeen,
  nudgeOrder,
  resetMock,
  setOrderLocked,
  setOrderPaid,
  setOrderStatus,
  setOrderWaReceived,
} from '../../api/client';
import { liveRefreshLoop, type LiveMessage } from '../../api/live';
import type { EventChannel } from 'redux-saga';
import type { MenuResponse, SellerMenuResponse } from '../../../shared/menuContract';
import type { SellerOrderResponse, SellerOrdersResponse } from '../../../shared/orderContract';
import {
  changeFailed,
  createFailed,
  createOrderRequested,
  lockChangeRequested,
  menuFailed,
  menuLoaded,
  menuRequested,
  noticeShown,
  nudgeRequested,
  orderCreated,
  orderSaved,
  ordersFailed,
  ordersLoaded,
  paidChangeRequested,
  pollingStarted,
  pollingStopped,
  refreshRequested,
  seenRequested,
  statusChangeRequested,
  waReceivedRequested,
  weekLoaded,
} from './sellerOrdersSlice';
import { currentSellerSlug } from '../../api/device/sellerContext';

/** How often the list reloads while the live socket is down (the fallback). */
export const POLL_MS = 60_000;

export function* loadOrders() {
  const result = (yield call(
    fetchSellerOrders,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrdersResponse>;
  if (result.ok) yield put(ordersLoaded({ orders: result.data.orders }));
  else yield put(ordersFailed());
}

function* loadWeek() {
  const result = (yield call(fetchMenu, currentSellerSlug())) as ApiResult<MenuResponse>;
  if (result.ok) yield put(weekLoaded({ cookingDate: result.data.week.cookingDate }));
}

// Live updates (stage 8.3): while a seller screen is shown the list reloads when the seller's
// Durable Object says something changed (api/live.ts), and every `pollMs` while the socket is down.
// Phase 5 note: the "Live" dot still shows whether the last load worked; the socket's own status
// (`Reconnecting…`) can drive it once the screens are reworked.
function* refresh() {
  yield call(loadWeek);
  yield call(loadOrders);
}

function* watchPolling(pollMs: number, channel?: () => EventChannel<LiveMessage>) {
  while (true) {
    yield take(pollingStarted.type);
    yield race({
      poll: call(liveRefreshLoop, {
        load: refresh,
        fallbackMs: pollMs,
        ...(channel ? { channel } : {}),
      }),
      stop: take(pollingStopped.type),
    });
  }
}

export function* changeStatus(action: ReturnType<typeof statusChangeRequested>) {
  const { code, to } = action.payload;
  const result = (yield call(
    setOrderStatus,
    code,
    to,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'status', code, to } }));
}

export function* changePaid(action: ReturnType<typeof paidChangeRequested>) {
  const { code, paid } = action.payload;
  const result = (yield call(
    setOrderPaid,
    code,
    paid,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'paid', code, paid } }));
}

export function* changeLock(action: ReturnType<typeof lockChangeRequested>) {
  const { code, locked } = action.payload;
  const result = (yield call(
    setOrderLocked,
    code,
    locked,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'lock', code, locked } }));
}

export function* changeWaReceived(action: ReturnType<typeof waReceivedRequested>) {
  const { code, received } = action.payload;
  const result = (yield call(
    setOrderWaReceived,
    code,
    received,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'wa', code, received } }));
}

export function* nudge(action: ReturnType<typeof nudgeRequested>) {
  const { code } = action.payload;
  const result = (yield call(
    nudgeOrder,
    code,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) {
    yield put(orderSaved({ order: result.data.order }));
    yield put(noticeShown({ notice: 'nudged' }));
  } else yield put(changeFailed({ failed: { kind: 'nudge', code } }));
}

export function* markSeen(action: ReturnType<typeof seenRequested>) {
  const { code } = action.payload;
  const result = (yield call(
    markOrderSeen,
    code,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'seen', code } }));
}

export function* loadSellerMenu() {
  const result = (yield call(
    fetchSellerMenu,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerMenuResponse>;
  if (result.ok) yield put(menuLoaded({ items: result.data.items }));
  else yield put(menuFailed());
}

export function* createOrder(action: ReturnType<typeof createOrderRequested>) {
  const result = (yield call(
    createSellerOrder,
    action.payload,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderCreated({ order: result.data.order }));
  else yield put(createFailed({ error: result.error }));
}

// Dev only: the Worker has these routes only in dev.
export function* devSampleOrders() {
  yield call(addSampleOrders, 5, currentSellerSlug());
  yield call(loadOrders);
}

export function* devReset() {
  yield call(resetMock);
  yield call(loadOrders);
}

export function* sellerOrdersSaga(
  pollMs: number = POLL_MS,
  channel?: () => EventChannel<LiveMessage>,
) {
  yield takeLatest(refreshRequested.type, loadOrders);
  yield takeEvery(statusChangeRequested.type, changeStatus);
  yield takeEvery(paidChangeRequested.type, changePaid);
  yield takeEvery(lockChangeRequested.type, changeLock);
  yield takeEvery(waReceivedRequested.type, changeWaReceived);
  yield takeEvery(nudgeRequested.type, nudge);
  yield takeEvery(seenRequested.type, markSeen);
  yield takeLatest(menuRequested.type, loadSellerMenu);
  yield takeLeading(createOrderRequested.type, createOrder);
  // Only the dev buttons dispatch these, and they show only when the server has DEV_TOOLS on.
  yield takeLatest(devSampleOrdersRequested.type, devSampleOrders);
  yield takeLatest(devResetRequested.type, devReset);
  yield call(watchPolling, pollMs, channel);
}
