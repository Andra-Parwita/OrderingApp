import { all, call } from 'redux-saga/effects';
import { customerSaga } from '../features/customer-menu';
import { customerOrdersSaga } from '../features/customer-orders';
import { cookSaga } from '../features/seller-cook';
import { sellerOrdersSaga } from '../features/seller-orders';
import { settingsSaga } from '../features/seller-settings';
import { shareSaga } from '../features/seller-share';

export function* rootSaga() {
  yield all([
    call(customerSaga),
    call(customerOrdersSaga),
    call(sellerOrdersSaga),
    call(cookSaga),
    call(shareSaga),
    call(settingsSaga),
  ]);
}
