import { all, call } from 'redux-saga/effects';
import { customerSaga } from '../features/customer-menu';
import { sellerOrdersSaga } from '../features/seller-orders';

export function* rootSaga() {
  yield all([call(customerSaga), call(sellerOrdersSaga)]);
}
