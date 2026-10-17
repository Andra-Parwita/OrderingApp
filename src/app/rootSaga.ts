import { all, call } from 'redux-saga/effects';
import { customerSaga } from '../features/customer-menu';
import { customerOrdersSaga } from '../features/customer-orders';
import { cookSaga } from '../features/seller-cook';
import { privateSaga } from '../features/seller-private';
import { sellerOrdersSaga } from '../features/seller-orders';
import { menuSaga } from '../features/seller-menu';
import { settingsSaga } from '../features/seller-settings';
import { setupSaga } from '../features/seller-setup';
import { shareSaga } from '../features/seller-share';

export function* rootSaga() {
  yield all([
    call(customerSaga),
    call(customerOrdersSaga),
    call(sellerOrdersSaga),
    call(cookSaga),
    call(privateSaga),
    call(shareSaga),
    call(settingsSaga),
    call(menuSaga),
    call(setupSaga),
  ]);
}
