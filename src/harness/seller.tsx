import { configureStore } from '@reduxjs/toolkit';
import { useCallback, useMemo, useState } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import {
  NewOrderScreen,
  OrderDetailScreen,
  OrdersScreen,
  sellerOrdersReducer,
  sellerOrdersSaga,
  type StatusFilter,
} from '../features/seller-orders';
import { AppThemeProvider } from '../theme/AppThemeProvider';

// ?harness=seller&screen=orders|detail|new&code=K7F2QX; talks to the dev Worker mock API.
// Own store and theme, so the screens run without the app shell (the real app uses routes).

type Screen = { name: 'orders' } | { name: 'new' } | { name: 'detail'; code: string };

function createHarnessStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerOrders: sellerOrdersReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(sellerOrdersSaga);
  return store;
}

function initialScreen(): Screen {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (params.get('screen') === 'new') return { name: 'new' };
  return params.get('screen') === 'detail' && code ? { name: 'detail', code } : { name: 'orders' };
}

export function SellerHarness() {
  const store = useMemo(() => createHarnessStore(), []);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const openOrder = useCallback((code: string) => setScreen({ name: 'detail', code }), []);
  const back = useCallback(() => setScreen({ name: 'orders' }), []);
  const newOrder = useCallback(() => setScreen({ name: 'new' }), []);

  return (
    <Provider store={store}>
      <AppThemeProvider>
        {screen.name === 'new' ? <NewOrderScreen onBack={back} onDone={back} /> : null}
        {screen.name === 'orders' ? (
          <OrdersScreen
            filter={filter}
            query={query}
            onFilterChange={setFilter}
            onQueryChange={setQuery}
            onOpenOrder={openOrder}
            onNewOrder={newOrder}
          />
        ) : null}
        {screen.name === 'detail' ? <OrderDetailScreen code={screen.code} onBack={back} /> : null}
      </AppThemeProvider>
    </Provider>
  );
}

export const Harness = SellerHarness;
