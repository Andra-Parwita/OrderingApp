import type { EventChannel } from 'redux-saga';
import { all, call, put, race, take, takeLatest } from 'redux-saga/effects';
import { sellerBackupMs } from '../../api/backupMinutes';
import { liveRefreshLoop, type Changed, type LiveMessage } from '../../api/live';
import type { ApiResult } from '../../api/http';
import { staffSignedOut } from '../../api/staffSignedOut';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchMade } from '../../api/made';
import { fetchSellerMenu, fetchSellerOrders } from '../../api/client';
import type { MadeResponse } from '../../../shared/madeContract';
import type { SellerMenuResponse } from '../../../shared/menuContract';
import type { SellerOrdersResponse } from '../../../shared/orderContract';
import { loaded, loadFailed, pollingStarted, pollingStopped, refreshRequested } from './cookSlice';

export function* loadCook(changed: Changed) {
  // Plan 074: an event names what changed. Orders and made counts move with `order.*` (a made tap
  // is signalled as `order.changed`); the menu with `menu.changed`; a day sale (`stock.changed`)
  // shows nowhere on this screen. No event (first load, reconnect, backup check) = everything.
  const everything = changed === null;
  const wantOrders = everything || changed.has('order.created') || changed.has('order.changed');
  const wantMenu = everything || changed.has('menu.changed');
  if (!wantOrders && !wantMenu) return;
  const slug = currentSellerSlug();
  const [orders, made, menu] = (yield all([
    wantOrders ? call(fetchSellerOrders, undefined, slug) : null,
    wantOrders ? call(fetchMade, undefined, slug) : null,
    wantMenu ? call(fetchSellerMenu, undefined, slug) : null,
  ])) as [
    ApiResult<SellerOrdersResponse> | null,
    ApiResult<MadeResponse> | null,
    ApiResult<SellerMenuResponse> | null,
  ];
  if ((orders && !orders.ok) || (made && !made.ok) || (menu && !menu.ok)) {
    yield put(loadFailed());
    return;
  }
  yield put(
    loaded({
      ...(orders?.ok ? { orders: orders.data.orders } : {}),
      ...(made?.ok ? { made: made.data.made } : {}),
      ...(menu?.ok
        ? {
            menu: {
              kitchenName: menu.data.kitchen.name,
              cookingDate: menu.data.week.cookingDate,
              items: menu.data.items,
              chefs: menu.data.chefs,
              pickupPoints: menu.data.week.pickupPoints,
            },
          }
        : {}),
    }),
  );
}

function* loadEverything() {
  yield call(loadCook, null);
}

// Live updates (stage 8.3): reload when the seller's Durable Object reports an order or menu
// change (api/live.ts); every `pollMs` (the admin's seller backup check) while the socket is down.
function* watchPolling(pollMs: number | (() => number), channel?: () => EventChannel<LiveMessage>) {
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
  pollMs: number | (() => number) = sellerBackupMs,
  channel?: () => EventChannel<LiveMessage>,
) {
  yield takeLatest(refreshRequested.type, loadEverything);
  yield call(watchPolling, pollMs, channel);
}
