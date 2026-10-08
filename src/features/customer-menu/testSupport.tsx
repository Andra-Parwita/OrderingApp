import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { ThemeProvider } from 'styled-components';
import type { ReactElement } from 'react';
import type { Language } from '../../../shared/domain';
import rootEn from '../../i18n/en.json';
import rootId from '../../i18n/id.json';
import { lightTheme } from '../../theme/themes';
import { customerReducer } from './customerSlice';
import { registerCustomerI18n } from './i18n/register';
import { customerSaga } from './saga';

/** Test-only: a store with the slice and the saga, like the harness builds. */
export function createTestStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { customer: customerReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(customerSaga);
  return store;
}

export async function setupI18n(lng: Language): Promise<void> {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: { en: { translation: rootEn }, id: { translation: rootId } },
      lng,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
  }
  registerCustomerI18n();
  await i18n.changeLanguage(lng);
}

export function renderWithStore(ui: ReactElement, store = createTestStore()) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>
      </Provider>,
    ),
  };
}
