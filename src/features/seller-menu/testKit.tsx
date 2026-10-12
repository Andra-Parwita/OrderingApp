import { configureStore, type Middleware } from '@reduxjs/toolkit';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { beforeAll } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerMenuI18n } from './i18n/register';
import { menuReducer, opRequested, type MenuData } from './menuSlice';

// Shared by the seller-menu component tests of plans 063, 064 and 066: a store that records the ops
// a screen requests, and the i18n/matchMedia set-up.

export function useMenuTestSetup(): void {
  beforeAll(async () => {
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
  });
}

export function menuWrapper(data: MenuData): {
  sent: Array<unknown>;
  wrap: (ui: ReactNode) => ReactNode;
} {
  const sent: Array<unknown> = [];
  const spy: Middleware = () => (next) => (action) => {
    if (opRequested.match(action)) sent.push(action.payload);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data, busy: false, result: null, seq: 0 },
    },
    middleware: (defaults) => defaults().concat(spy),
  });
  return {
    sent,
    wrap: (ui) => (
      <Provider store={store}>
        <MemoryRouter>
          <AppThemeProvider>{ui}</AppThemeProvider>
        </MemoryRouter>
      </Provider>
    ),
  };
}
