import { call, fork, put, select, takeLatest } from 'redux-saga/effects';
import type { CreateOrderRequest, UpdateOrderRequest } from '../../../shared/orderContract';
import {
  placeOrder as placeOrderRequest,
  fetchMenu,
  fetchOrder,
  updateOrder,
} from '../../api/client';
import { rememberKitchen } from '../../api/device/lastKitchen';
import { rememberAddress } from '../../api/device/address';
import { customerCodeFor } from '../../api/device/customerCode';
import { rememberFirstName } from '../../api/device/firstName';
import { isReturningCustomer, saveMyOrder } from '../../api/device/myOrders';
import { refreshMenuNotice } from '../../components/install/menuNoticeDevice';
import {
  editFailed,
  editLoaded,
  editRequested,
  menuFailed,
  menuLoaded,
  menuRequested,
  orderFailed,
  orderLoaded,
  orderRequested,
  placeFailed,
  placeRequested,
  placeSucceeded,
  updateFailed,
  updateRequested,
  updateSucceeded,
  type CustomerRootState,
} from './customerSlice';
import { basketDraftSaga, basketKeyOf, clientOrderIdFor, forgetClientOrder } from './basketDraft';
import { selectBasket, selectBasketNotes, selectEdit } from './selectors';

export function* loadMenu(action: ReturnType<typeof menuRequested>) {
  const result = (yield call(fetchMenu, action.payload)) as Awaited<ReturnType<typeof fetchMenu>>;
  if (result.ok) {
    yield call(rememberKitchen, action.payload);
    yield put(menuLoaded(result.data));
  } else {
    yield put(menuFailed(result.error));
  }
}

/** The stock or the cut-off moved: load the menu again so the basket is trimmed and the banner can say what changed. */
export function* refreshMenuAfter(code: string, slug: string | null) {
  if (slug === null) return;
  if (
    code === 'sold_out' ||
    code === 'exceeds_remaining' ||
    code === 'cutoff_passed' ||
    code === 'ordering_closed' ||
    code === 'kitchen_closed'
  ) {
    yield put(menuRequested(slug));
  }
}

export function* placeOrder(action: ReturnType<typeof placeRequested>) {
  const notes = (yield select((state: CustomerRootState) => selectBasketNotes(state))) as Record<
    string,
    string
  >;
  const basket = (yield select((state: CustomerRootState) => selectBasket(state))) as Record<
    string,
    number
  >;
  const { firstName, language, fulfilment, note, pickupPlaceId, address } = action.payload;
  const trimmedNote = note.trim();
  // A phone that already has a collected or delivered order is a returning customer (D-027).
  const slug = (yield select((state: CustomerRootState) => state.customer.slug)) as string | null;
  if (slug === null) return;
  const returning = (yield call(isReturningCustomer, slug)) as boolean;
  const customerCode = (yield call(customerCodeFor, slug)) as string | null;
  const input: CreateOrderRequest = {
    firstName: firstName.trim(),
    language,
    fulfilment,
    lines: Object.entries(basket).map(([itemId, qty]) => ({
      itemId,
      qty,
      ...(notes[itemId] ? { note: notes[itemId] } : {}),
    })),
    ...(trimmedNote !== '' ? { note: trimmedNote } : {}),
    ...(fulfilment === 'pickup' && pickupPlaceId !== undefined ? { pickupPlaceId } : {}),
    ...(returning ? { returning: true } : {}),
    ...(fulfilment === 'delivery' && address ? { address } : {}),
    ...(customerCode !== null ? { customerCode } : {}),
  };
  // Plan 114: the same order sent again (its answer was lost) must not become a second order.
  const key = (yield select((state: CustomerRootState) => basketKeyOf(state))) as string | null;
  const clientOrderId = clientOrderIdFor(key, JSON.stringify(input));
  let result = (yield call(placeOrderRequest, slug, { ...input, clientOrderId })) as Awaited<
    ReturnType<typeof placeOrderRequest>
  >;
  // Quiet retry: no answer (timeout, dropped link) is sent once more with the same id, which the server
  // answers with the first order if it did get through.
  if (!result.ok && result.error === 'network') {
    result = (yield call(placeOrderRequest, slug, { ...input, clientOrderId })) as Awaited<
      ReturnType<typeof placeOrderRequest>
    >;
  }
  if (result.ok) {
    yield call(saveMyOrder, result.data.order);
    yield call(rememberFirstName, result.data.order.firstName);
    if (input.address) yield call(rememberAddress, input.address);
    yield put(placeSucceeded(result.data.order));
    // Plan 112: an order keeps a turned-on new-menu notice alive; fire and forget.
    yield fork(refreshMenuNotice, slug, language);
  } else {
    // Only "no answer" (network, 5xx, unreadable) keeps the id for the retry; a definitive 4xx
    // answer (sold out, invalid, closed, rate limit) starts the next try fresh.
    if (result.status >= 400 && result.status < 500) forgetClientOrder(key);
    yield put(placeFailed({ code: result.error, message: result.message }));
    yield call(refreshMenuAfter, result.error, slug);
  }
}

export function* loadOrder(action: ReturnType<typeof orderRequested>) {
  const result = (yield call(fetchOrder, action.payload)) as Awaited<ReturnType<typeof fetchOrder>>;
  if (result.ok) yield put(orderLoaded(result.data.order));
  else yield put(orderFailed(result.error));
}

export function* loadEdit(action: ReturnType<typeof editRequested>) {
  const result = (yield call(fetchOrder, action.payload)) as Awaited<ReturnType<typeof fetchOrder>>;
  if (result.ok) yield put(editLoaded(result.data.order));
  else yield put(editFailed(result.error));
}

export function* saveEdit(action: ReturnType<typeof updateRequested>) {
  const edit = (yield select((state: CustomerRootState) => selectEdit(state))) as ReturnType<
    typeof selectEdit
  >;
  if (edit.status !== 'ready') return;
  const notes = (yield select((state: CustomerRootState) => selectBasketNotes(state))) as Record<
    string,
    string
  >;
  const basket = (yield select((state: CustomerRootState) => selectBasket(state))) as Record<
    string,
    number
  >;
  const patch: UpdateOrderRequest = {
    lines: Object.entries(basket).map(([itemId, qty]) => ({
      itemId,
      qty,
      note: notes[itemId] ?? '',
    })),
    fulfilment: action.payload.fulfilment,
    // An empty note clears it.
    note: action.payload.note.trim(),
    ...(action.payload.fulfilment === 'delivery' && action.payload.address
      ? { address: action.payload.address }
      : {}),
  };
  const result = (yield call(updateOrder, edit.order.token, patch)) as Awaited<
    ReturnType<typeof updateOrder>
  >;
  if (result.ok) {
    yield call(saveMyOrder, result.data.order);
    if (patch.address) yield call(rememberAddress, patch.address);
    yield put(updateSucceeded(result.data.order));
  } else {
    yield put(updateFailed({ code: result.error, message: result.message }));
    const slug = (yield select((state: CustomerRootState) => state.customer.slug)) as string | null;
    yield call(refreshMenuAfter, result.error, slug);
  }
}

export function* customerSaga() {
  yield takeLatest(menuRequested.type, loadMenu);
  yield takeLatest(placeRequested.type, placeOrder);
  yield takeLatest(orderRequested.type, loadOrder);
  yield takeLatest(editRequested.type, loadEdit);
  yield takeLatest(updateRequested.type, saveEdit);
  yield fork(basketDraftSaga);
}
