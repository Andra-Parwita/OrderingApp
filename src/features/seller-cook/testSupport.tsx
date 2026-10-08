import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import type { Order, OrderLine, SellerMenuItemView } from '../../../shared/domain';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import type { CookMenu } from './cookModel';
import { cookSaga } from './cookSaga';
import { cookReducer, loaded } from './cookSlice';
import { registerCookI18n } from './i18n/register';

/** Test-only helpers shared by this feature's tests. */
const none = { en: '', id: '' };

function item(
  id: string,
  en: string,
  idName: string,
  extra: Partial<SellerMenuItemView> = {},
): SellerMenuItemView {
  return {
    id,
    name: { en, id: idName },
    description: none,
    size: { en: '1 portion', id: '1 porsi' },
    priceCents: 1000,
    remaining: null,
    soldOut: false,
    ...extra,
  };
}

export const MENU: CookMenu = {
  kitchenName: 'Delave',
  cookingDate: '2026-10-10',
  chefs: [{ id: 'wati', sellerId: 's1', name: 'Chef Wati' }],
  items: [
    item('nasi', 'Mixed rice', 'Nasi campur', { priceCents: 1500 }),
    item('lemper', 'Chicken lemper', 'Lemper ayam', { chefId: 'wati', limit: 20 }),
    item('tempe', 'Tempeh', 'Tempe mendoan', { chefId: 'wati' }),
    item('ayam', 'Fried chicken', 'Ayam goreng', { priceCents: 1250 }),
  ],
};

export function line(itemId: string, qty: number): OrderLine {
  const found = MENU.items.find((candidate) => candidate.id === itemId);
  if (!found) throw new Error(itemId);
  return {
    itemId,
    name: found.name,
    size: found.size,
    priceCents: found.priceCents,
    qty,
  };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    sellerId: 's1',
    code: 'K7F2QX',
    token: 'tok-k7f2qx',
    firstName: 'Rina',
    language: 'en',
    lines: [line('lemper', 2)],
    fulfilment: 'pickup',
    status: 'confirmed',
    paid: false,
    locked: false,
    waReceived: false,
    returning: false,
    changed: false,
    inbox: [],
    audit: [],
    createdAt: '2026-10-07T08:12:00Z',
    updatedAt: '2026-10-07T08:12:00Z',
    ...overrides,
  };
}

/** Rina (confirmed, paid, note), Tom (ordered, delivery), Dewi (cancelled), Sari (confirmed). */
export function sampleOrders(): Array<Order> {
  return [
    makeOrder({
      id: 'o1',
      code: 'K7F2QX',
      firstName: 'Rina',
      lines: [line('lemper', 2), line('nasi', 1)],
      paid: true,
      note: 'No chilli on the tempeh please',
    }),
    makeOrder({
      id: 'o2',
      code: 'M3H9TD',
      firstName: 'Tom',
      status: 'ordered',
      fulfilment: 'delivery',
      lines: [line('lemper', 3), line('tempe', 1)],
      note: 'Peanut allergy',
    }),
    makeOrder({
      id: 'o3',
      code: 'H9D7RV',
      firstName: 'Dewi',
      status: 'cancelled',
      lines: [line('lemper', 10)],
      note: 'Cancelled order note',
    }),
    makeOrder({
      id: 'o4',
      code: 'R8P4WB',
      firstName: 'Sari',
      fulfilment: 'delivery',
      lines: [line('ayam', 2)],
    }),
  ];
}

export function createTestStore(options: { saga: boolean; pollMs?: number }) {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerCook: cookReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  if (options.saga) sagaMiddleware.run(cookSaga, options.pollMs);
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
  registerCookI18n();
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
  store.dispatch(loaded({ orders, menu: MENU }));
}
