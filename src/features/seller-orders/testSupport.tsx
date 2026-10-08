import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import type { Order } from '../../../shared/domain';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerI18n } from './i18n/register';
import { sellerOrdersSaga } from './sellerOrdersSaga';
import { ordersLoaded, sellerOrdersReducer } from './sellerOrdersSlice';

/** Test-only helpers shared by this feature's unit and component tests. */
export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    code: 'K7F2QX',
    token: 'tok-k7f2qx',
    firstName: 'Rina',
    language: 'en',
    lines: [
      {
        itemId: 'lemper',
        name: { en: 'Chicken lemper', id: 'Lemper ayam' },
        size: { en: '4 pieces', id: '4 biji' },
        priceCents: 1000,
        qty: 2,
      },
    ],
    fulfilment: 'pickup',
    status: 'confirmed',
    paid: false,
    locked: false,
    waReceived: false,
    returning: false,
    changed: false,
    inbox: [],
    audit: [
      { by: { role: 'customer', name: 'Rina' }, what: 'created', at: '2026-10-07T08:12:00Z' },
    ],
    createdAt: '2026-10-07T08:12:00Z',
    updatedAt: '2026-10-07T08:12:00Z',
    ...overrides,
  };
}

export function createTestStore(options: { saga: boolean; pollMs?: number }) {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerOrders: sellerOrdersReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  if (options.saga) sagaMiddleware.run(sellerOrdersSaga, options.pollMs);
  return store;
}
export type TestStore = ReturnType<typeof createTestStore>;

export async function setupI18n(): Promise<void> {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerSellerI18n();
  await i18n.changeLanguage('en');
}

export function renderWithStore(ui: ReactNode, store: TestStore) {
  return render(
    <Provider store={store}>
      <AppThemeProvider>{ui}</AppThemeProvider>
    </Provider>,
  );
}

export function seed(store: TestStore, orders: Array<Order>): void {
  store.dispatch(ordersLoaded({ orders }));
}
