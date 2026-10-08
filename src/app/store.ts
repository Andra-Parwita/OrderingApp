import { combineReducers, configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { customerReducer } from '../features/customer-menu';
import { sellerOrdersReducer } from '../features/seller-orders';
import { rootSaga } from './rootSaga';

const rootReducer = combineReducers({
  customer: customerReducer,
  sellerOrders: sellerOrdersReducer,
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
