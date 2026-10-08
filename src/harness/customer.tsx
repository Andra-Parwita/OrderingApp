// ?harness=customer[&seller=<slug>][&screen=menu|basket|placed[&token=...]]: the customer flow (C1, C2, C3) on
// its own store, against the dev Worker's mock API. Dev and e2e only.
import { configureStore } from '@reduxjs/toolkit';
import { useCallback, useEffect, useState } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import {
  BasketScreen,
  MenuScreen,
  OrderPlacedScreen,
  customerReducer,
  customerSaga,
  placeRequested,
  quantitySet,
  selectPlace,
} from '../features/customer-menu';
import { AppThemeProvider } from '../theme/AppThemeProvider';

/** The seller whose menu the harness shows: `?seller=<slug>`, else the first sample seller. */
const SLUG = new URLSearchParams(window.location.search).get('seller') ?? 'onde-onde';

type View =
  { name: 'menu' } | { name: 'basket' } | { name: 'placed'; token: string } | { name: 'seeding' };

function createStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { customer: customerReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(customerSaga);
  return store;
}

function initialView(params: URLSearchParams): View {
  switch (params.get('screen')) {
    case 'basket':
      return { name: 'basket' };
    case 'placed': {
      const token = params.get('token');
      return token ? { name: 'placed', token } : { name: 'seeding' };
    }
    default:
      return { name: 'menu' };
  }
}

type SeedingProps = Readonly<{ onPlaced: (token: string) => void }>;

/** `screen=placed` without a token: place a small sample order first so C3 has something to show. */
function Seeding({ onPlaced }: SeedingProps) {
  const dispatch = useDispatch();
  const place = useSelector(selectPlace);
  useEffect(() => {
    dispatch(quantitySet({ itemId: 'lemper', qty: 1 }));
    dispatch(
      placeRequested({
        firstName: `Harness-${Date.now()}`,
        language: 'en',
        fulfilment: 'pickup',
        note: '',
      }),
    );
  }, [dispatch]);
  const token = place.status === 'placed' ? place.token : null;
  useEffect(() => {
    if (token !== null) onPlaced(token);
  }, [token, onPlaced]);
  return <p>Placing a sample order…</p>;
}

function Flow() {
  const [view, setView] = useState<View>(() => initialView(new URLSearchParams(location.search)));
  const toMenu = useCallback(() => setView({ name: 'menu' }), []);
  const toBasket = useCallback(() => setView({ name: 'basket' }), []);
  const toPlaced = useCallback((token: string) => setView({ name: 'placed', token }), []);
  const noop = useCallback(() => undefined, []);

  switch (view.name) {
    case 'menu':
      return <MenuScreen slug={SLUG} onViewBasket={toBasket} />;
    case 'basket':
      return <BasketScreen slug={SLUG} onBack={toMenu} onPlaced={toPlaced} />;
    case 'placed':
      return <OrderPlacedScreen token={view.token} onChange={noop} />;
    case 'seeding':
      return <Seeding onPlaced={toPlaced} />;
    default: {
      const unreachable: never = view;
      return unreachable;
    }
  }
}

export function Harness() {
  // i18n (with both features' strings) is ready before this module loads: see main.tsx.
  const [store] = useState(createStore);
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <Flow />
      </AppThemeProvider>
    </Provider>
  );
}
