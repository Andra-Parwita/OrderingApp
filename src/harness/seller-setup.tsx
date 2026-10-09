import { configureStore } from '@reduxjs/toolkit';
import { useMemo } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import {
  ChefsScreen,
  ImagesScreen,
  registerSellerSetupI18n,
  setupReducer,
  setupSaga,
} from '../features/seller-setup';
import { AppThemeProvider } from '../theme/AppThemeProvider';

// ?harness=seller-setup&screen=images|chefs; talks to the dev Worker mock API.
// Own store, theme and strings, so the screens run without the app shell (6.3 adds the routes).

registerSellerSetupI18n();

function createHarnessStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerSetup: setupReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(setupSaga);
  return store;
}

function Screen() {
  const screen = new URLSearchParams(window.location.search).get('screen');
  if (screen === 'images') return <ImagesScreen />;
  return <ChefsScreen />;
}

export function SellerSetupHarness() {
  const store = useMemo(() => createHarnessStore(), []);
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <Screen />
      </AppThemeProvider>
    </Provider>
  );
}

export const Harness = SellerSetupHarness;
