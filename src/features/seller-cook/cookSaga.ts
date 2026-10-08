import { all, call, delay, put, race, take, takeLatest } from 'redux-saga/effects';
import type { ApiResult } from '../../api/http';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchSellerMenu, fetchSellerOrders } from '../../api/client';
import type { SellerMenuResponse } from '../../../shared/menuContract';
import type { SellerOrdersResponse } from '../../../shared/orderContract';
import { loaded, loadFailed, pollingStarted, pollingStopped, refreshRequested } from './cookSlice';

export const COOK_POLL_MS = 15000;

export function* loadCook() {
  const [orders, menu] = (yield all([
    call(fetchSellerOrders, undefined, currentSellerSlug()),
    call(fetchSellerMenu, undefined, currentSellerSlug()),
  ])) as [ApiResult<SellerOrdersResponse>, ApiResult<SellerMenuResponse>];
  if (orders.ok && menu.ok) {
    yield put(
      loaded({
        orders: orders.data.orders,
        menu: {
          kitchenName: menu.data.kitchen.name,
          cookingDate: menu.data.week.cookingDate,
          items: menu.data.items,
          chefs: menu.data.chefs,
        },
      }),
    );
  } else {
    yield put(loadFailed());
  }
}

// Phase 4 live: the Durable Object connection replaces this polling.
function* pollLoop(pollMs: number) {
  while (true) {
    yield call(loadCook);
    yield delay(pollMs);
  }
}

function* watchPolling(pollMs: number) {
  while (true) {
    yield take(pollingStarted.type);
    yield race({ poll: call(pollLoop, pollMs), stop: take(pollingStopped.type) });
  }
}

export function* cookSaga(pollMs: number = COOK_POLL_MS) {
  yield takeLatest(refreshRequested.type, loadCook);
  yield call(watchPolling, pollMs);
}
