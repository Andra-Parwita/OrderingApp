import {
  call,
  delay,
  put,
  race,
  take,
  takeEvery,
  takeLatest,
  takeLeading,
} from 'redux-saga/effects';
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

export const POLL_MS = 5000;

export function* loadOrders() {
  const result = (yield call(fetchSellerOrders)) as ApiResult<SellerOrdersResponse>;
  if (result.ok) yield put(ordersLoaded({ orders: result.data.orders }));
  else yield put(ordersFailed());
}

function* loadWeek() {
  const result = (yield call(fetchMenu)) as ApiResult<MenuResponse>;
  if (result.ok) yield put(weekLoaded({ cookingDate: result.data.week.cookingDate }));
}

// Phase 4 replaces this polling with the Durable Object live connection (the "Live" indicator
// then reflects the socket instead of the last poll).
function* pollLoop(pollMs: number) {
  yield call(loadWeek);
  while (true) {
    yield call(loadOrders);
    yield delay(pollMs);
  }
}

function* watchPolling(pollMs: number) {
  while (true) {
    yield take(pollingStarted.type);
    yield race({ poll: call(pollLoop, pollMs), stop: take(pollingStopped.type) });
  }
}

export function* changeStatus(action: ReturnType<typeof statusChangeRequested>) {
  const { code, to } = action.payload;
  const result = (yield call(setOrderStatus, code, to)) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'status', code, to } }));
}

export function* changePaid(action: ReturnType<typeof paidChangeRequested>) {
  const { code, paid } = action.payload;
  const result = (yield call(setOrderPaid, code, paid)) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'paid', code, paid } }));
}

export function* changeLock(action: ReturnType<typeof lockChangeRequested>) {
  const { code, locked } = action.payload;
  const result = (yield call(setOrderLocked, code, locked)) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'lock', code, locked } }));
}

export function* changeWaReceived(action: ReturnType<typeof waReceivedRequested>) {
  const { code, received } = action.payload;
  const result = (yield call(setOrderWaReceived, code, received)) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'wa', code, received } }));
}

export function* nudge(action: ReturnType<typeof nudgeRequested>) {
  const { code } = action.payload;
  const result = (yield call(nudgeOrder, code)) as ApiResult<SellerOrderResponse>;
  if (result.ok) {
    yield put(orderSaved({ order: result.data.order }));
    yield put(noticeShown({ notice: 'nudged' }));
  } else yield put(changeFailed({ failed: { kind: 'nudge', code } }));
}

export function* markSeen(action: ReturnType<typeof seenRequested>) {
  const { code } = action.payload;
  const result = (yield call(markOrderSeen, code)) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'seen', code } }));
}

export function* loadSellerMenu() {
  const result = (yield call(fetchSellerMenu)) as ApiResult<SellerMenuResponse>;
  if (result.ok) yield put(menuLoaded({ items: result.data.items }));
  else yield put(menuFailed());
}

export function* createOrder(action: ReturnType<typeof createOrderRequested>) {
  const result = (yield call(createSellerOrder, action.payload)) as ApiResult<SellerOrderResponse>;
  if (result.ok) yield put(orderCreated({ order: result.data.order }));
  else yield put(createFailed({ error: result.error }));
}

// Dev only: the Worker has these routes only in dev.
export function* devSampleOrders() {
  yield call(addSampleOrders, 5);
  yield call(loadOrders);
}

export function* devReset() {
  yield call(resetMock);
  yield call(loadOrders);
}

export function* sellerOrdersSaga(pollMs: number = POLL_MS) {
  yield takeLatest(refreshRequested.type, loadOrders);
  yield takeEvery(statusChangeRequested.type, changeStatus);
  yield takeEvery(paidChangeRequested.type, changePaid);
  yield takeEvery(lockChangeRequested.type, changeLock);
  yield takeEvery(waReceivedRequested.type, changeWaReceived);
  yield takeEvery(nudgeRequested.type, nudge);
  yield takeEvery(seenRequested.type, markSeen);
  yield takeLatest(menuRequested.type, loadSellerMenu);
  yield takeLeading(createOrderRequested.type, createOrder);
  if (import.meta.env.DEV) {
    yield takeLatest(devSampleOrdersRequested.type, devSampleOrders);
    yield takeLatest(devResetRequested.type, devReset);
  }
  yield call(watchPolling, pollMs);
}
