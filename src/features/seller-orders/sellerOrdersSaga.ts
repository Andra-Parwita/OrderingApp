import {
  call,
  delay,
  put,
  race,
  select,
  spawn,
  take,
  takeEvery,
  takeLatest,
  takeLeading,
} from 'redux-saga/effects';
import { devResetRequested, devSampleOrdersRequested } from './devActions';
import { demoSamplesClearRequested, demoSamplesRequested } from './demoActions';
import { addDemoSamples, clearDemoSamples } from '../../api/demo';
import type { ApiFailure, ApiResult } from '../../api/http';
import {
  addSampleOrders,
  createSellerOrder,
  fetchCurrentMenu,
  fetchPastWeeks,
  fetchSellerMenu,
  fetchSellerOrders,
  markOrderCollected,
  markOrderSeen,
  setTakingOrders,
  updateItem,
  nudgeOrder,
  resetMock,
  setOrderLocked,
  setOrderPaid,
  setOrderStatus,
  setOrderWaReceived,
} from '../../api/client';
import { liveRefreshLoop, type LiveMessage } from '../../api/live';
import { playChime } from '../../components/chime';
import type { Order } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import type { EventChannel } from 'redux-saga';
import type { ClearSamplesResponse, SampleOrdersResponse } from '../../../shared/devContract';
import type { SellerMenuResponse } from '../../../shared/menuContract';
import type { MenuViewResponse, UpdateMenuResponse } from '../../../shared/menusContract';
import type { PastWeeksResponse } from '../../../shared/pastWeeks';
import type { ItemResponse } from '../../../shared/setupContract';
import type { SellerOrderResponse, SellerOrdersResponse } from '../../../shared/orderContract';
import { newCustomerOrders, selectToast } from './sellerOrdersSelectors';
import {
  changeFailed,
  freshExpired,
  newOrdersArrived,
  type ActionToast,
  type FailedChange,
  warningDismissed,
  collectedRequested,
  createFailed,
  currentFailed,
  currentLoaded,
  currentRequested,
  dishPatchRequested,
  pastFailed,
  pastLoaded,
  pastRequested,
  takingOrdersRequested,
  devSamplingChanged,
  toastShown,
  type ToastKind,
  warningConfirmed,
  warningRaised,
  type SellerOrdersRootState,
  type Warned,
  type WarnedCall,
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
} from './sellerOrdersSlice';
import { staffSignedOut } from '../../api/staffSignedOut';
import { currentSellerSlug } from '../../api/device/sellerContext';

/** How often the list reloads while the live socket is down (the fallback). */
export const POLL_MS = 60_000;

/** Plan 021: how long a new order's row stays highlighted. */
export const FRESH_MS = 6000;

function* expireFresh(ids: Array<string>) {
  yield delay(FRESH_MS);
  yield put(freshExpired({ ids }));
}

/** Plan 021: toast, highlight, dot and (if the seller wants it) a chime for new customer orders. */
export function* announceNew(arrived: ReadonlyArray<Order>) {
  if (arrived.length === 0) return;
  const ids = arrived.map((order) => order.id);
  yield put(
    newOrdersArrived({
      orders: arrived.map(({ id, code, firstName }) => ({ id, code, firstName })),
    }),
  );
  // An Undo still open is not worth losing: the highlight and the dot say it anyway.
  const shown = (yield select(selectToast)) as ActionToast | null;
  const [only] = arrived;
  if (!shown?.undo && only) {
    yield put(
      toastShown(
        arrived.length === 1
          ? {
              kind: 'newOrder',
              name: `${only.firstName} · ${formatOrderCode(only.code)}`,
              undo: null,
              open: { code: only.code },
            }
          : { kind: 'newOrders', name: String(arrived.length), undo: null, open: { code: null } },
      ),
    );
  }
  yield call(playChime);
  yield spawn(expireFresh, ids);
}

export function* loadOrders() {
  const before = (yield select()) as SellerOrdersRootState;
  const result = (yield call(
    fetchSellerOrders,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrdersResponse>;
  if (result.ok) {
    yield put(ordersLoaded({ orders: result.data.orders }));
    // The first load is the baseline, not news.
    if (before.sellerOrders.list.status === 'ready') {
      yield call(announceNew, newCustomerOrders(before.sellerOrders.orders, result.data.orders));
    }
  } else yield put(ordersFailed());
}

export function* loadCurrent() {
  const result = (yield call(
    fetchCurrentMenu,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<MenuViewResponse>;
  if (result.ok) yield put(currentLoaded({ view: result.data.menu }));
  else yield put(currentFailed());
}

export function* loadPast() {
  const result = (yield call(
    fetchPastWeeks,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<PastWeeksResponse>;
  if (result.ok) yield put(pastLoaded({ weeks: result.data.weeks }));
  else yield put(pastFailed());
}

// Live updates (stage 8.3): while a seller screen is shown the list reloads when the seller's
// Durable Object says something changed (api/live.ts), and every `pollMs` while the socket is down.
// Phase 5 note: the "Live" dot still shows whether the last load worked; the socket's own status
// (`Reconnecting…`) can drive it once the screens are reworked.
function* refresh() {
  yield call(loadCurrent);
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
      stop: take([pollingStopped.type, staffSignedOut.type]),
    });
  }
}

/** A 409 with a warning body opens the dialog; anything else is a failed change. */
function* warnOr(result: ApiFailure, call: WarnedCall, name: string, failed: FailedChange | null) {
  if (result.status === 409 && result.warning) {
    yield put(warningRaised({ call, warning: result.warning, name } satisfies Warned));
  } else if (failed) yield put(changeFailed({ failed }));
}

function* nameOf(code: string) {
  const state = (yield select()) as SellerOrdersRootState;
  return state.sellerOrders.orders.find((order) => order.code === code)?.firstName ?? '';
}

export function* changeStatus(action: ReturnType<typeof statusChangeRequested>) {
  const { code, to, from, force, undo } = action.payload;
  const result = (yield call(
    setOrderStatus,
    code,
    to,
    undefined,
    currentSellerSlug(),
    force,
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) {
    yield put(orderSaved({ order: result.data.order }));
    // Confirm and cancel get a toast with Undo: the same call back to the old status, forced.
    if (!undo && (to === 'confirmed' || to === 'cancelled')) {
      yield put(
        toastShown({
          kind: to === 'confirmed' ? 'confirmed' : 'cancelled',
          name: result.data.order.firstName,
          undo: from ? { kind: 'status', code, to: from } : null,
        }),
      );
    }
  } else {
    const name = (yield call(nameOf, code)) as string;
    yield call(warnOr, result, { kind: 'status', code, to, ...(from ? { from } : {}) }, name, {
      kind: 'status',
      code,
      to,
    });
  }
}

export function* changePaid(action: ReturnType<typeof paidChangeRequested>) {
  const { code, paid, undo } = action.payload;
  const result = (yield call(
    setOrderPaid,
    code,
    paid,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) {
    yield put(orderSaved({ order: result.data.order }));
    if (paid && !undo) {
      yield put(
        toastShown({
          kind: 'paid',
          name: result.data.order.firstName,
          undo: { kind: 'paid', code, paid: false },
        }),
      );
    }
  } else yield put(changeFailed({ failed: { kind: 'paid', code, paid } }));
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
  const { code, force } = action.payload;
  const result = (yield call(
    nudgeOrder,
    code,
    undefined,
    currentSellerSlug(),
    force,
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) {
    yield put(orderSaved({ order: result.data.order }));
    yield put(noticeShown({ notice: 'nudged' }));
  } else {
    const name = (yield call(nameOf, code)) as string;
    yield call(warnOr, result, { kind: 'nudge', code }, name, { kind: 'nudge', code });
  }
}

/** The quiet Mark collected: no Undo (there is no route that takes it back). */
export function* markCollected(action: ReturnType<typeof collectedRequested>) {
  const { code, force } = action.payload;
  const result = (yield call(
    markOrderCollected,
    code,
    undefined,
    currentSellerSlug(),
    force,
  )) as ApiResult<SellerOrderResponse>;
  if (result.ok) {
    yield put(orderSaved({ order: result.data.order }));
    yield put(toastShown({ kind: 'collected', name: result.data.order.firstName, undo: null }));
  } else {
    const name = (yield call(nameOf, code)) as string;
    yield call(warnOr, result, { kind: 'collected', code }, name, null);
  }
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
  else if (result.status === 409 && result.warning) {
    yield put(
      warningRaised({
        call: { kind: 'create', request: action.payload },
        warning: result.warning,
        name: action.payload.firstName,
      }),
    );
  } else yield put(createFailed({ error: result.error }));
}

/** Continue anyway: the call that warned goes again with force. */
export function* sendForced() {
  const state = (yield select()) as SellerOrdersRootState;
  const warned = state.sellerOrders.warned;
  if (!warned) return;
  yield put(warningDismissed());
  const { call: again } = warned;
  switch (again.kind) {
    case 'status':
      yield put(
        statusChangeRequested({
          code: again.code,
          to: again.to,
          ...(again.from ? { from: again.from } : {}),
          force: true,
        }),
      );
      break;
    case 'collected':
      yield put(collectedRequested({ code: again.code, force: true }));
      break;
    case 'nudge':
      yield put(nudgeRequested({ code: again.code, force: true }));
      break;
    case 'create':
      yield put(createOrderRequested({ ...again.request, force: true }));
      break;
    default: {
      const unreachable: never = again;
      throw new Error(String(unreachable));
    }
  }
}

export function* changeTakingOrders(action: ReturnType<typeof takingOrdersRequested>) {
  const result = (yield call(
    setTakingOrders,
    action.payload.value,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<UpdateMenuResponse>;
  if (result.ok) yield put(currentLoaded({ view: result.data.menu }));
}

/** Live Dishes panel: limit and sold out go through today's menu item route (instant, D-069 Q2). */
export function* patchDish(action: ReturnType<typeof dishPatchRequested>) {
  const result = (yield call(
    updateItem,
    action.payload.id,
    action.payload.patch,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<ItemResponse>;
  if (result.ok) yield call(loadCurrent);
}

// Dev only: the Worker has these routes only in dev.
const DEV_SAMPLE_COUNT = 50;

/** Adds samples with `send`, shows how it went, and reloads the list. */
function* addSamplesWith(send: () => Promise<ApiResult<SampleOrdersResponse>>) {
  yield put(devSamplingChanged(true));
  try {
    const result = (yield call(send)) as ApiResult<SampleOrdersResponse>;
    if (result.ok) {
      const { added, reason } = result.data;
      const kind: ToastKind =
        reason === 'no_menu'
          ? 'sampleNoMenu'
          : added === 0
            ? 'sampleNone'
            : reason === 'sold_out'
              ? 'samplePartial'
              : 'sampleAdded';
      yield put(toastShown({ kind, name: String(added), undo: null }));
    } else {
      yield put(toastShown({ kind: 'sampleFailed', name: '', undo: null }));
    }
    yield call(loadOrders);
  } finally {
    yield put(devSamplingChanged(false));
  }
}

export function* devSampleOrders() {
  yield* addSamplesWith(() => addSampleOrders(DEV_SAMPLE_COUNT, currentSellerSlug()));
}

/** Plan 013: a demo kitchen adds its 50 samples (the server picks the count and checks the kitchen). */
export function* demoSamples() {
  yield* addSamplesWith(addDemoSamples);
}

/** Plan 013: a demo kitchen removes its sample orders (and only those). */
export function* demoSamplesClear() {
  yield put(devSamplingChanged(true));
  try {
    const result = (yield call(clearDemoSamples)) as ApiResult<ClearSamplesResponse>;
    yield put(
      result.ok
        ? toastShown({ kind: 'samplesCleared', name: String(result.data.removed), undo: null })
        : toastShown({ kind: 'clearFailed', name: '', undo: null }),
    );
    yield call(loadOrders);
  } finally {
    yield put(devSamplingChanged(false));
  }
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
  yield takeEvery(collectedRequested.type, markCollected);
  yield takeEvery(warningConfirmed.type, sendForced);
  yield takeLatest(takingOrdersRequested.type, changeTakingOrders);
  yield takeEvery(dishPatchRequested.type, patchDish);
  yield takeLatest(currentRequested.type, loadCurrent);
  yield takeLatest(pastRequested.type, loadPast);
  yield takeLatest(menuRequested.type, loadSellerMenu);
  yield takeLeading(createOrderRequested.type, createOrder);
  // Only the dev buttons dispatch these, and they show only when the server has DEV_TOOLS on.
  yield takeLeading(devSampleOrdersRequested.type, devSampleOrders);
  yield takeLatest(devResetRequested.type, devReset);
  // Plan 013: the demo kitchen's buttons; the server refuses anyone else.
  yield takeLeading(demoSamplesRequested.type, demoSamples);
  yield takeLeading(demoSamplesClearRequested.type, demoSamplesClear);
  yield call(watchPolling, pollMs, channel);
}
