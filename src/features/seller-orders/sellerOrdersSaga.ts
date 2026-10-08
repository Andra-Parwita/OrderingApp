import { call, delay, put, race, take, takeEvery, takeLatest } from 'redux-saga/effects';
import type { ApiResult } from '../../api/http';
import {
  addSampleOrders,
  fetchMenu,
  fetchSellerOrders,
  resetMock,
  setOrderPaid,
  setOrderStatus,
} from '../../api/client';
import type { MenuResponse } from '../../../shared/menuContract';
import type { OrderResponse, OrdersResponse } from '../../../shared/orderContract';
import {
  changeFailed,
  devResetRequested,
  devSampleOrdersRequested,
  orderSaved,
  ordersFailed,
  ordersLoaded,
  paidChangeRequested,
  pollingStarted,
  pollingStopped,
  refreshRequested,
  statusChangeRequested,
  weekLoaded,
} from './sellerOrdersSlice';

export const POLL_MS = 5000;

export function* loadOrders() {
  const result = (yield call(fetchSellerOrders)) as ApiResult<OrdersResponse>;
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
  const result = (yield call(setOrderStatus, code, to)) as ApiResult<OrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'status', code, to } }));
}

export function* changePaid(action: ReturnType<typeof paidChangeRequested>) {
  const { code, paid } = action.payload;
  const result = (yield call(setOrderPaid, code, paid)) as ApiResult<OrderResponse>;
  if (result.ok) yield put(orderSaved({ order: result.data.order }));
  else yield put(changeFailed({ failed: { kind: 'paid', code, paid } }));
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
  yield takeLatest(devSampleOrdersRequested.type, devSampleOrders);
  yield takeLatest(devResetRequested.type, devReset);
  yield call(watchPolling, pollMs);
}
