import type { EventChannel } from 'redux-saga';
import { all, call, put, race, take, takeLatest } from 'redux-saga/effects';
import { liveRefreshLoop, type LiveMessage } from '../../api/live';
import type { ApiResult } from '../../api/http';
import { staffSignedOut } from '../../api/staffSignedOut';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchSellerMenu, fetchSellerOrders } from '../../api/client';
import type { SellerMenuResponse } from '../../../shared/menuContract';
import type { SellerOrdersResponse } from '../../../shared/orderContract';
import { loaded, loadFailed, pollingStarted, pollingStopped, refreshRequested } from './cookSlice';

/** How often the screen reloads while the live socket is down (the fallback). */
export const COOK_POLL_MS = 60_000;

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
          pickupPoints: menu.data.week.pickupPoints,
        },
      }),
    );
  } else {
    yield put(loadFailed());
  }
}

// Live updates (stage 8.3): reload when the seller's Durable Object reports an order or menu
// change (api/live.ts); every `pollMs` while the socket is down.
function* watchPolling(pollMs: number, channel?: () => EventChannel<LiveMessage>) {
  while (true) {
    yield take(pollingStarted.type);
    yield race({
      poll: call(liveRefreshLoop, {
        load: loadCook,
        fallbackMs: pollMs,
        ...(channel ? { channel } : {}),
      }),
      stop: take([pollingStopped.type, staffSignedOut.type]),
    });
  }
}

export function* cookSaga(
  pollMs: number = COOK_POLL_MS,
  channel?: () => EventChannel<LiveMessage>,
) {
  yield takeLatest(refreshRequested.type, loadCook);
  yield call(watchPolling, pollMs, channel);
}
