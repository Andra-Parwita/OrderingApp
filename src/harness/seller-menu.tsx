import { configureStore } from '@reduxjs/toolkit';
import { useMemo } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import createSagaMiddleware from 'redux-saga';
import {
  DishesScreen,
  MakeMenuScreen,
  MenuScreen,
  SavedSetsScreen,
  menuReducer,
  menuSaga,
  parseStep,
  parseTab,
  registerSellerMenuI18n,
  type MenuSlots,
} from '../features/seller-menu';
import {
  MenuPreview as CustomerMenuPreview,
  registerCustomerI18n,
} from '../features/customer-menu';
import {
  ShareComposer,
  registerShareI18n,
  shareReducer,
  shareSaga,
} from '../features/seller-share';
import { AppThemeProvider } from '../theme/AppThemeProvider';

// ?harness=seller-menu&screen=menu|make/dishes|make/details|make/check|make/publish|edit/dishes|
// edit/details|edit/prices|dishes|sets; talks to the dev Worker mock API. Own store, theme and
// strings, with a memory router so the screens can move between each other.

registerSellerMenuI18n();
registerShareI18n();
registerCustomerI18n();

const slots: MenuSlots = {
  preview: ({ slug, menu }) => <CustomerMenuPreview slug={slug} menu={menu} />,
  share: ({ onGoToOrders }) => <ShareComposer withLink onGoToOrders={onGoToOrders} />,
};

function createHarnessStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerMenu: menuReducer, sellerShare: shareReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(menuSaga);
  sagaMiddleware.run(shareSaga);
  return store;
}

function Make({ mode }: Readonly<{ mode: 'make' | 'edit' }>) {
  const { step } = useParams();
  const name = mode === 'make' ? parseStep(step) : parseTab(step);
  return name === null ? null : <MakeMenuScreen mode={mode} step={name} slots={slots} />;
}

export function SellerMenuHarness() {
  const store = useMemo(() => createHarnessStore(), []);
  const screen = new URLSearchParams(window.location.search).get('screen') ?? 'menu';
  const start = screen === 'menu' ? '/seller/menu' : `/seller/menu/${screen}`;
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[start]}>
          <Routes>
            <Route path="/seller/menu" element={<MenuScreen />} />
            <Route path="/seller/menu/make/:step" element={<Make mode="make" />} />
            <Route path="/seller/menu/edit/:step" element={<Make mode="edit" />} />
            <Route path="/seller/menu/dishes" element={<DishesScreen />} />
            <Route path="/seller/menu/sets" element={<SavedSetsScreen />} />
          </Routes>
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>
  );
}

export const Harness = SellerMenuHarness;
