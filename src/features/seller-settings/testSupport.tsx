import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSettingsI18n } from './i18n/register';
import { settingsSaga } from './settingsSaga';
import { settingsReducer } from './settingsSlice';

/** Test-only helpers shared by this feature's tests. */
export function createTestStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerSettings: settingsReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(settingsSaga);
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
  registerSettingsI18n();
  await i18n.changeLanguage('en');
}

export function renderWithStore(ui: ReactNode, store: TestStore) {
  return render(
    <Provider store={store}>
      <AppThemeProvider>{ui}</AppThemeProvider>
    </Provider>,
  );
}
