import { all, call, put, race, select, take, takeLatest } from 'redux-saga/effects';
import { staffSignedOut } from '../../api/staffSignedOut';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchMade } from '../../api/made';
import { fetchPrivate } from '../../api/private';
import { fetchSellerMenu } from '../../api/client';
import type { ApiResult } from '../../api/http';
import type { MadeResponse } from '../../../shared/madeContract';
import type { SellerMenuResponse } from '../../../shared/menuContract';
import type { PrivateListResponse } from '../../../shared/privateContract';
import {
  currentMenuLoaded,
  ordersLoaded,
  ordersPollingStarted,
  ordersPollingStopped,
  ordersRefreshRequested,
  type KitchenOrdersRootState,
} from '../../api/kitchenOrders';
import { loaded, loadFailed, pollingStarted, pollingStopped, refreshRequested } from './cookSlice';

/**
 * Plan 098 C5: the kitchen's orders come from the Orders slice (one fetch, one live loop). Cook
 * fetches only what is its own: made counts and today's private orders (they move with the
 * orders), and the seller menu (it moves with the menu).
 */
export function* loadCook(parts: { orders: boolean; menu: boolean }) {
  const slug = currentSellerSlug();
  const [made, menu, privateToday] = (yield all([
    parts.orders ? call(fetchMade, undefined, slug) : null,
    parts.menu ? call(fetchSellerMenu, undefined, slug) : null,
    // Plan 081: today's private orders move with the same order events.
    parts.orders ? call(fetchPrivate, { day: 'today' }, slug) : null,
  ])) as [
    ApiResult<MadeResponse> | null,
    ApiResult<SellerMenuResponse> | null,
    ApiResult<PrivateListResponse> | null,
  ];
  if ((made && !made.ok) || (menu && !menu.ok) || (privateToday && !privateToday.ok)) {
    yield put(loadFailed());
    return;
  }
  yield put(
    loaded({
      ...(privateToday?.ok ? { privateOrders: privateToday.data.orders } : {}),
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
  // The retry button: the Orders slice reloads its list, Cook its own parts.
  yield put(ordersRefreshRequested());
  yield call(loadCook, { orders: true, menu: true });
}

// While the Cook screen is open it holds one subscription to the Orders live loop. Each Orders
// reload (an `order.*` event, a reconnect, a backup check) brings the made counts and private
// orders; each current-menu reload (a `menu.changed` event) brings the seller menu. A part whose
// Orders data is already loaded is fetched now; otherwise the first Orders load brings it.
function* followOrders() {
  const state = (yield select()) as KitchenOrdersRootState;
  const already = {
    orders: state.sellerOrders.list.status === 'ready',
    menu: state.sellerOrders.current.status === 'ready',
  };
  if (already.orders || already.menu) yield call(loadCook, already);
  while (true) {
    const action = (yield take([ordersLoaded.type, currentMenuLoaded.type])) as { type: string };
    yield call(loadCook, {
      orders: action.type === ordersLoaded.type,
      menu: action.type === currentMenuLoaded.type,
    });
  }
}

function* watchPolling() {
  while (true) {
    yield take(pollingStarted.type);
    yield put(ordersPollingStarted());
    yield race({
      follow: call(followOrders),
      stop: take([pollingStopped.type, staffSignedOut.type]),
    });
    yield put(ordersPollingStopped());
  }
}

export function* cookSaga() {
  yield takeLatest(refreshRequested.type, loadEverything);
  yield call(watchPolling);
}
