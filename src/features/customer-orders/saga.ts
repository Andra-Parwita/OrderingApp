import { all, call, put, takeEvery, takeLatest } from 'redux-saga/effects';
import { TOKENS_MAX } from '../../../shared/limits';
import type { FetchedOrderResponse } from '../../../shared/orderContract';
import { markCollected } from '../../api/customer';
import { cancelOrder, fetchMenu, fetchMyOrders, fetchOrderOrExpired } from '../../api/client';
import { readMyOrders, rememberStatus } from '../../api/device/myOrders';
import {
  cancelFailed,
  cancelRequested,
  collectFailed,
  collectRequested,
  listFailed,
  listLoaded,
  listRequested,
  menuLoaded,
  menuRequested,
  orderExpired,
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
  yield put(listLoaded({ orders, expired: result.data.expired ?? [], saved: readMyOrders() }));
  // Each seller's week (cooking date) sorts their orders into "this week" and "earlier".
  // Archived orders are always earlier, so their sellers need no menu.
  const slugs = [
    ...new Set(orders.filter((order) => order.archived !== true).map((o) => o.seller.slug)),
  ];
  yield all(slugs.map((slug) => call(loadMenu, menuRequested(slug))));
}

export function* loadMenu(action: ReturnType<typeof menuRequested>) {
  const result = (yield call(fetchMenu, action.payload)) as Awaited<ReturnType<typeof fetchMenu>>;
  // A seller that cannot be reached just has no week: the order page works without it.
  if (result.ok) yield put(menuLoaded(result.data));
}

type Fetched = Awaited<ReturnType<typeof fetchOrderOrExpired>>;

/** Shows what came back. Device storage is only ever added to or updated, never emptied. */
function* showFetched(data: FetchedOrderResponse) {
  if ('expired' in data) {
    yield put(orderExpired(data.expired));
    return;
  }
  yield call(rememberStatus, data.order);
  yield put(orderLoaded(data.order));
  // A closed week has no use for the menu: the order page is read-only.
  if (data.order.archived !== true) yield call(loadMenu, menuRequested(data.order.seller.slug));
}

export function* loadOrder(action: ReturnType<typeof orderRequested>) {
  const result = (yield call(fetchOrderOrExpired, action.payload)) as Fetched;
  if (result.ok) yield* showFetched(result.data);
  else yield put(orderFailed(result.error));
}

export function* refreshOrder(action: ReturnType<typeof orderRefreshRequested>) {
  const result = (yield call(fetchOrderOrExpired, action.payload)) as Fetched;
  if (result.ok) yield* showFetched(result.data);
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

export function* collect(action: ReturnType<typeof collectRequested>) {
  const result = (yield call(markCollected, action.payload)) as Awaited<
    ReturnType<typeof markCollected>
  >;
  if (result.ok) {
    yield call(rememberStatus, result.data.order);
    yield put(orderLoaded(result.data.order));
  } else {
    yield put(collectFailed(result.error));
  }
}

export function* customerOrdersSaga() {
  yield takeLatest(listRequested.type, loadList);
  yield takeEvery(menuRequested.type, loadMenu);
  yield takeLatest(orderRequested.type, loadOrder);
  yield takeLatest(orderRefreshRequested.type, refreshOrder);
  yield takeEvery(cancelRequested.type, cancel);
  yield takeLatest(collectRequested.type, collect);
}
