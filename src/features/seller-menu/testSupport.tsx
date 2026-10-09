import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { mockStore } from '../../../mocks/handlers';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerMenuI18n } from './i18n/register';
import { menuSaga } from './menuSaga';
import { menuReducer } from './menuSlice';

/** Test-only helpers shared by this feature's tests. */
export function createTestStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(menuSaga);
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
  registerSellerMenuI18n();
  await i18n.changeLanguage('en');
}

export function renderWithStore(ui: ReactNode, store: TestStore = createTestStore()) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </Provider>,
    ),
  };
}

/** A customer order for `itemId` (the week must be published), then back to a draft week. */
export function orderThenDraft(itemId: string): void {
  const placed = mockStore.createOrder({
    firstName: 'Rina',
    language: 'en',
    lines: [{ itemId, qty: 1 }],
    fulfilment: 'pickup',
  });
  if (!placed.ok) throw new Error(placed.error);
  mockStore.setWeek({ status: 'draft' });
}

/** Fills the menu to the 10-item limit. */
export function fillMenu(): void {
  while (mockStore.getSellerMenu().items.length < 10) {
    mockStore.addItem({
      name: { en: `Extra ${String(mockStore.getSellerMenu().items.length)}`, id: '' },
      priceCents: 500,
    });
  }
}

export function emptyMenu(): void {
  for (const item of mockStore.getSellerMenu().items) mockStore.removeItem(item.id);
}
