import { all, call, put, takeEvery, takeLatest } from 'redux-saga/effects';
import { TOKENS_MAX } from '../../../shared/limits';
import { cancelOrder, fetchMenu, fetchMyOrders, fetchOrder } from '../../api/client';
import { readMyOrders, rememberStatus } from '../../api/device/myOrders';
import {
  cancelFailed,
  cancelRequested,
  listFailed,
  listLoaded,
  listRequested,
  menuLoaded,
  menuRequested,
  orderFailed,
  orderLoaded,
  orderRefreshRequested,
  orderRequested,
} from './slice';

export function* loadList() {
  const saved = readMyOrders().slice(0, TOKENS_MAX);
  if (saved.length === 0) {
    yield put(listLoaded({ orders: [], saved: [] }));
    return;
  }
  const result = (yield call(
    fetchMyOrders,
    saved.map((entry) => entry.token),
  )) as Awaited<ReturnType<typeof fetchMyOrders>>;
  if (!result.ok) {
    yield put(listFailed(result.error));
    return;
  }
  for (const order of result.data.orders) yield call(rememberStatus, order);
  const orders = [...result.data.orders].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  yield put(listLoaded({ orders, saved: readMyOrders() }));
  // Each seller's week (cooking date) sorts their orders into "this week" and "earlier".
  const slugs = [...new Set(orders.map((order) => order.seller.slug))];
  yield all(slugs.map((slug) => call(loadMenu, menuRequested(slug))));
}

export function* loadMenu(action: ReturnType<typeof menuRequested>) {
  const result = (yield call(fetchMenu, action.payload)) as Awaited<ReturnType<typeof fetchMenu>>;
  // A seller that cannot be reached just has no week: the order page works without it.
  if (result.ok) yield put(menuLoaded(result.data));
}

export function* loadOrder(action: ReturnType<typeof orderRequested>) {
  const result = (yield call(fetchOrder, action.payload)) as Awaited<ReturnType<typeof fetchOrder>>;
  if (result.ok) {
    yield call(rememberStatus, result.data.order);
    yield put(orderLoaded(result.data.order));
    yield call(loadMenu, menuRequested(result.data.order.seller.slug));
  } else {
    yield put(orderFailed(result.error));
  }
}

export function* refreshOrder(action: ReturnType<typeof orderRefreshRequested>) {
  const result = (yield call(fetchOrder, action.payload)) as Awaited<ReturnType<typeof fetchOrder>>;
  if (result.ok) {
    yield call(rememberStatus, result.data.order);
    yield put(orderLoaded(result.data.order));
    yield call(loadMenu, menuRequested(result.data.order.seller.slug));
  }
}

export function* cancel(action: ReturnType<typeof cancelRequested>) {
  const result = (yield call(cancelOrder, action.payload)) as Awaited<
    ReturnType<typeof cancelOrder>
  >;
  if (result.ok) {
    yield call(rememberStatus, result.data.order);
    yield put(orderLoaded(result.data.order));
  } else {
    yield put(cancelFailed(result.error));
  }
}

export function* customerOrdersSaga() {
  yield takeLatest(listRequested.type, loadList);
  yield takeEvery(menuRequested.type, loadMenu);
  yield takeLatest(orderRequested.type, loadOrder);
  yield takeLatest(orderRefreshRequested.type, refreshOrder);
  yield takeEvery(cancelRequested.type, cancel);
}
