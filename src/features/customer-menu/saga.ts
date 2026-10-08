import { call, put, select, takeLatest } from 'redux-saga/effects';
import type { CreateOrderRequest } from '../../../shared/orderContract';
import { createOrder, fetchMenu, fetchOrder } from '../../api/client';
import {
  menuFailed,
  menuLoaded,
  menuRequested,
  orderFailed,
  orderLoaded,
  orderRequested,
  placeFailed,
  placeRequested,
  placeSucceeded,
  type CustomerRootState,
} from './customerSlice';
import { saveMyOrder } from './myOrders';
import { selectBasket } from './selectors';

export function* loadMenu() {
  const result = (yield call(fetchMenu)) as Awaited<ReturnType<typeof fetchMenu>>;
  if (result.ok) yield put(menuLoaded(result.data));
  else yield put(menuFailed(result.error));
}

export function* placeOrder(action: ReturnType<typeof placeRequested>) {
  const basket = (yield select((state: CustomerRootState) => selectBasket(state))) as Record<
    string,
    number
  >;
  const { firstName, language, fulfilment, note } = action.payload;
  const trimmedNote = note.trim();
  const input: CreateOrderRequest = {
    firstName: firstName.trim(),
    language,
    fulfilment,
    lines: Object.entries(basket).map(([itemId, qty]) => ({ itemId, qty })),
    ...(trimmedNote !== '' ? { note: trimmedNote } : {}),
  };
  const result = (yield call(createOrder, input)) as Awaited<ReturnType<typeof createOrder>>;
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

export function* customerSaga() {
  yield takeLatest(menuRequested.type, loadMenu);
  yield takeLatest(placeRequested.type, placeOrder);
  yield takeLatest(orderRequested.type, loadOrder);
}
