// ?harness=customer-orders[&screen=list|order[&token=...]]: My orders (C4), the order page
// (C5/C5b) and the basket in edit mode, on their own store against the dev Worker's mock API.
// Dev and e2e only. Without a token, a sample order is created through the API first.
import { configureStore } from '@reduxjs/toolkit';
import { useCallback, useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { createOrder } from '../api/client';
import { readMyOrders, saveMyOrder } from '../api/device/myOrders';
import {
  MyOrdersScreen,
  OrderScreen,
  customerOrdersReducer,
  customerOrdersSaga,
  registerCustomerOrdersI18n,
} from '../features/customer-orders';
import { BasketScreen, customerReducer, customerSaga } from '../features/customer-menu';
import { AppThemeProvider } from '../theme/AppThemeProvider';

// main.tsx registers the other features' strings; this feature's own are added here until the app
// wires them (stage 4.4).
registerCustomerOrdersI18n();

type View =
  | { name: 'seeding'; next: 'list' | 'order' }
  | { name: 'list' }
  | { name: 'order'; token: string }
  | { name: 'edit'; token: string };

function createStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { customer: customerReducer, customerOrders: customerOrdersReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(customerSaga);
  sagaMiddleware.run(customerOrdersSaga);
  return store;
}

function initialView(params: URLSearchParams): View {
  const token = params.get('token');
  if (params.get('screen') === 'order') {
    return token ? { name: 'order', token } : { name: 'seeding', next: 'order' };
  }
  return readMyOrders().length > 0 ? { name: 'list' } : { name: 'seeding', next: 'list' };
}

/** Places one small sample order through the API and remembers it on this phone. */
function Seeding({
  next,
  onDone,
}: Readonly<{ next: 'list' | 'order'; onDone: (v: View) => void }>) {
  useEffect(() => {
    let cancelled = false;
    void createOrder({
      firstName: `Harness-${Date.now()}`,
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'lemper', qty: 1 }],
    }).then((result) => {
      if (cancelled || !result.ok) return;
      saveMyOrder(result.data.order);
      onDone(
        next === 'order' ? { name: 'order', token: result.data.order.token } : { name: 'list' },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [next, onDone]);
  return <p>Placing a sample order…</p>;
}

function Flow() {
  const [view, setView] = useState<View>(() => initialView(new URLSearchParams(location.search)));
  const toList = useCallback(() => setView({ name: 'list' }), []);
  const toOrder = useCallback((token: string) => setView({ name: 'order', token }), []);
  const toEdit = useCallback((token: string) => setView({ name: 'edit', token }), []);
  const noop = useCallback(() => undefined, []);

  switch (view.name) {
    case 'seeding':
      return <Seeding next={view.next} onDone={setView} />;
    case 'list':
      return <MyOrdersScreen onBack={noop} onOpenOrder={toOrder} />;
    case 'order':
      return <OrderScreen token={view.token} onBack={toList} onChange={toEdit} />;
    case 'edit':
      return (
        <BasketScreen
          editToken={view.token}
          onBack={() => toOrder(view.token)}
          onPlaced={noop}
          onUpdated={toOrder}
        />
      );
    default: {
      const unreachable: never = view;
      return unreachable;
    }
  }
}

export function Harness() {
  const [store] = useState(createStore);
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <Flow />
      </AppThemeProvider>
    </Provider>
  );
}
