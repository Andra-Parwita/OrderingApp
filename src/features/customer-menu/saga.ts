import { call, put, select, takeLatest } from 'redux-saga/effects';
import type { CreateOrderRequest, UpdateOrderRequest } from '../../../shared/orderContract';
import {
  placeOrder as placeOrderRequest,
  fetchMenu,
  fetchOrder,
  updateOrder,
} from '../../api/client';
import { rememberKitchen } from '../../api/device/lastKitchen';
import { isReturningCustomer, saveMyOrder } from '../../api/device/myOrders';
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
import { selectBasket, selectEdit } from './selectors';

export function* loadMenu(action: ReturnType<typeof menuRequested>) {
  const result = (yield call(fetchMenu, action.payload)) as Awaited<ReturnType<typeof fetchMenu>>;
  if (result.ok) {
    yield call(rememberKitchen, action.payload);
    yield put(menuLoaded(result.data));
  } else {
    yield put(menuFailed(result.error));
  }
}

export function* placeOrder(action: ReturnType<typeof placeRequested>) {
  const basket = (yield select((state: CustomerRootState) => selectBasket(state))) as Record<
    string,
    number
  >;
  const { firstName, language, fulfilment, note } = action.payload;
  const trimmedNote = note.trim();
  // A phone that already has a collected or delivered order is a returning customer (D-027).
  const slug = (yield select((state: CustomerRootState) => state.customer.slug)) as string | null;
  if (slug === null) return;
  const returning = (yield call(isReturningCustomer, slug)) as boolean;
  const input: CreateOrderRequest = {
    firstName: firstName.trim(),
    language,
    fulfilment,
    lines: Object.entries(basket).map(([itemId, qty]) => ({ itemId, qty })),
    ...(trimmedNote !== '' ? { note: trimmedNote } : {}),
    ...(returning ? { returning: true } : {}),
  };
  const result = (yield call(placeOrderRequest, slug, input)) as Awaited<
    ReturnType<typeof placeOrderRequest>
  >;
  if (result.ok) {
    yield call(saveMyOrder, result.data.order);
    yield put(placeSucceeded(result.data.order));
  } else {
    yield put(placeFailed({ code: result.error, message: result.message }));
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
  const basket = (yield select((state: CustomerRootState) => selectBasket(state))) as Record<
    string,
    number
  >;
  const patch: UpdateOrderRequest = {
    lines: Object.entries(basket).map(([itemId, qty]) => ({ itemId, qty })),
    fulfilment: action.payload.fulfilment,
    // An empty note clears it.
    note: action.payload.note.trim(),
  };
  const result = (yield call(updateOrder, edit.order.token, patch)) as Awaited<
    ReturnType<typeof updateOrder>
  >;
  if (result.ok) {
    yield call(saveMyOrder, result.data.order);
    yield put(updateSucceeded(result.data.order));
  } else {
    yield put(updateFailed({ code: result.error, message: result.message }));
  }
}

export function* customerSaga() {
  yield takeLatest(menuRequested.type, loadMenu);
  yield takeLatest(placeRequested.type, placeOrder);
  yield takeLatest(orderRequested.type, loadOrder);
  yield takeLatest(editRequested.type, loadEdit);
  yield takeLatest(updateRequested.type, saveEdit);
}
