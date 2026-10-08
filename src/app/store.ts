import { combineReducers, configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { customerReducer } from '../features/customer-menu';
import { customerOrdersReducer } from '../features/customer-orders';
import { cookReducer } from '../features/seller-cook';
import { sellerOrdersReducer } from '../features/seller-orders';
import { settingsReducer } from '../features/seller-settings';
import { shareReducer } from '../features/seller-share';
import { rootSaga } from './rootSaga';

const rootReducer = combineReducers({
  customer: customerReducer,
  customerOrders: customerOrdersReducer,
  sellerOrders: sellerOrdersReducer,
  sellerCook: cookReducer,
  sellerShare: shareReducer,
  sellerSettings: settingsReducer,
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
