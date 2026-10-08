import { configureStore } from '@reduxjs/toolkit';
import { useMemo } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { all, call } from 'redux-saga/effects';
import { CookScreen, cookReducer, cookSaga, registerCookI18n } from '../features/seller-cook';
import {
  SettingsScreen,
  registerSettingsI18n,
  settingsReducer,
  settingsSaga,
} from '../features/seller-settings';
import { ShareScreen, registerShareI18n, shareReducer, shareSaga } from '../features/seller-share';
import { AppThemeProvider } from '../theme/AppThemeProvider';

// ?harness=seller-tools&screen=cook|share|settings; talks to the dev Worker mock API.
// Own store, theme and strings, so the screens run without the app shell (4.4 adds the routes).

registerCookI18n();
registerShareI18n();
registerSettingsI18n();

function createHarnessStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: {
      sellerCook: cookReducer,
      sellerShare: shareReducer,
      sellerSettings: settingsReducer,
    },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(function* rootSaga() {
    yield all([call(cookSaga), call(shareSaga), call(settingsSaga)]);
  });
  return store;
}

function Screen() {
  const screen = new URLSearchParams(window.location.search).get('screen');
  if (screen === 'share') return <ShareScreen />;
  if (screen === 'settings') return <SettingsScreen />;
  return <CookScreen />;
}

export function SellerToolsHarness() {
  const store = useMemo(() => createHarnessStore(), []);
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <Screen />
      </AppThemeProvider>
    </Provider>
  );
}

export const Harness = SellerToolsHarness;
