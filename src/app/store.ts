import { combineReducers, configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { customerReducer } from '../features/customer-menu';
import { customerOrdersReducer } from '../features/customer-orders';
import { cookReducer } from '../features/seller-cook/cookSlice';
import { privateReducer } from '../features/seller-private/privateSlice';
import { sellerOrdersReducer } from '../features/seller-orders/sellerOrdersSlice';
import { menuReducer } from '../features/seller-menu/menuSlice';
import { settingsReducer } from '../features/seller-settings/settingsSlice';
import { setupReducer } from '../features/seller-setup/setupSlice';
import { shareReducer } from '../features/seller-share/shareSlice';
import { rootSaga } from './rootSaga';

const rootReducer = combineReducers({
  customer: customerReducer,
  customerOrders: customerOrdersReducer,
  sellerOrders: sellerOrdersReducer,
  sellerCook: cookReducer,
  sellerPrivate: privateReducer,
  sellerShare: shareReducer,
  sellerSettings: settingsReducer,
  sellerMenu: menuReducer,
  sellerSetup: setupReducer,
});

export function createAppStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(rootSaga);
  return store;
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
