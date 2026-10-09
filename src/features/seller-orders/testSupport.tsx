import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import createSagaMiddleware, { type EventChannel } from 'redux-saga';
import type { LiveMessage } from '../../api/live';
import type { Order } from '../../../shared/domain';
import type { MenuView } from '../../../shared/menusContract';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerI18n } from './i18n/register';
import { sellerOrdersSaga } from './sellerOrdersSaga';
import { currentLoaded, ordersLoaded, pastLoaded, sellerOrdersReducer } from './sellerOrdersSlice';

/** Test-only helpers shared by this feature's unit and component tests. */
export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    sellerId: 's1',
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

export function createTestStore(options: {
  saga: boolean;
  pollMs?: number;
  /** A fake live channel (api/live.ts); without it the saga finds no socket and only polls. */
  channel?: () => EventChannel<LiveMessage>;
}) {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerOrders: sellerOrdersReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  if (options.saga) sagaMiddleware.run(sellerOrdersSaga, options.pollMs, options.channel);
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
      <AppThemeProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
}

export function seed(store: TestStore, orders: Array<Order>): void {
  store.dispatch(ordersLoaded({ orders }));
}

/** A menu as the server sends it; `state` decides what Home shows. */
export function makeMenuView(
  state: MenuView['menu']['state'] = 'live',
  overrides: Partial<MenuView['menu']> = {},
): MenuView {
  return {
    menu: {
      id: 'm1',
      state,
      cookingDate: '2026-10-17',
      cutoffAt: '2026-10-15T20:00:00+11:00',
      delivery: { available: true, note: { en: '', id: '' } },
      wizardStep: 3,
      takingOrders: true,
      placeUses: [{ placeId: 'p1' }],
      ...overrides,
    },
    dishes: [
      {
        id: 'lemper',
        name: { en: 'Chicken lemper', id: 'Lemper ayam' },
        description: { en: '', id: '' },
        size: { en: '4 pieces', id: '4 biji' },
        priceCents: 1000,
        limit: 10,
        remaining: 6,
        soldOut: false,
      },
    ],
    pickupPoints: [
      {
        id: 'p1',
        place: 'Glenelg',
        directions: { en: '', id: '' },
        window: { start: '10:00', end: '12:00' },
      },
    ],
  };
}

export function seedMenu(
  store: TestStore,
  view: MenuView,
  weeks: Parameters<typeof pastLoaded>[0]['weeks'] = [],
): void {
  store.dispatch(currentLoaded({ view }));
  store.dispatch(pastLoaded({ weeks }));
}
