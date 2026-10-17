import { configureStore, type Middleware, type UnknownAction } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeAll } from 'vitest';
import { initI18n } from '../i18n/init';
import { registerSellerI18n } from '../features/seller-orders';
import { registerSellerMenuI18n, menuReducer, type MenuData } from '../features/seller-menu';
import { registerPrivateI18n, privateReducer, type PrivateState } from '../features/seller-private';
import { dish } from '../features/seller-private/testSupport';
import { AppThemeProvider } from '../theme/AppThemeProvider';

export function setupPrivateTests(): void {
  beforeAll(async () => {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList;
    if (!i18n.isInitialized) await initI18n();
    registerSellerI18n();
    registerSellerMenuI18n();
    registerPrivateI18n();
    await i18n.changeLanguage('en');
  });
}

export const menuDataOf = (dishes: Array<ReturnType<typeof dish>>): MenuData =>
  ({
    view: {
      menu: { id: 'm1', state: 'live', cookingDate: '2026-10-24', wizardStep: 4 },
      dishes: [],
      pickupPoints: [],
    },
    dishes,
    sets: [],
    places: [{ id: 'home', place: 'Home kitchen' }],
    chefs: [],
    prefs: {},
    past: [],
  }) as unknown as MenuData;

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}</output>;
}

/** Renders `ui` with the private and menu slices preloaded; `actions` records what was dispatched. */
export function mountPrivate(
  ui: ReactNode,
  state: PrivateState,
  data: MenuData | null = null,
  at = '/seller/private',
) {
  const actions: Array<UnknownAction> = [];
  const spy: Middleware = () => (next) => (action) => {
    actions.push(action as UnknownAction);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerPrivate: privateReducer, sellerMenu: menuReducer },
    preloadedState: {
      sellerPrivate: state,
      sellerMenu: { load: 'ready' as const, data, busy: false, result: null, seq: 0 },
    },
    middleware: (defaults) => defaults().concat(spy),
  });
  const view = render(
    <Provider store={store}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[at]}>
          {ui}
          <Where />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
  return { store, actions, ...view };
}
