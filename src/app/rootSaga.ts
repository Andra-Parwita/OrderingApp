import { all, call } from 'redux-saga/effects';
import { customerSaga } from '../features/customer-menu';
import { customerOrdersSaga } from '../features/customer-orders';
import { cookSaga } from '../features/seller-cook/cookSaga';
import { privateSaga } from '../features/seller-private/privateSaga';
import { sellerOrdersSaga } from '../features/seller-orders/sellerOrdersSaga';
import { menuSaga } from '../features/seller-menu/menuSaga';
import { settingsSaga } from '../features/seller-settings/settingsSaga';
import { setupSaga } from '../features/seller-setup/setupSaga';
import { shareSaga } from '../features/seller-share/shareSaga';

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
