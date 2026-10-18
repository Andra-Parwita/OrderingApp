import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware, { type EventChannel } from 'redux-saga';
import type { LiveMessage } from '../api/live';
import { cookReducer, cookSaga } from '../features/seller-cook';
import { sellerOrdersReducer, sellerOrdersSaga } from '../features/seller-orders';

/** Plan 098 C5: the real Orders slice and saga next to Cook's, as the app wires them. */
export function createCookOrdersStore(options: {
  pollMs?: number;
  /** A fake live channel (api/live.ts); without it the saga finds no socket and only polls. */
  channel?: () => EventChannel<LiveMessage>;
}) {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerCook: cookReducer, sellerOrders: sellerOrdersReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(sellerOrdersSaga, options.pollMs, options.channel);
  sagaMiddleware.run(cookSaga);
  return store;
}
