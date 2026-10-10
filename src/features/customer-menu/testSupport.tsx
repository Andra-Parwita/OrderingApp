import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { ThemeProvider } from 'styled-components';
import { useState, type ReactElement } from 'react';
import type { Language } from '../../../shared/domain';
import rootEn from '../../i18n/en.json';
import rootId from '../../i18n/id.json';
import { lightTheme } from '../../theme/themes';
import { BasketScreen, EditOrderFlow, type CheckoutStep } from './BasketScreen';
import { customerReducer } from './customerSlice';
import { registerInstallI18n } from '../../components/install';
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
  registerInstallI18n();
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

const noop = () => undefined;

type FlowProps = Readonly<{
  slug?: string;
  /** Change-order mode: the token of the order being changed. */
  editToken?: string;
  onBack?: () => void;
  onPlaced?: (token: string) => void;
  onUpdated?: (token: string) => void;
}>;

/** Test-only: the checkout pages with the routing replaced by a step (basket, pickup, name). */
export function CheckoutFlow({
  slug,
  editToken,
  onBack = noop,
  onPlaced = noop,
  onUpdated,
}: FlowProps) {
  const [step, setStep] = useState<CheckoutStep>('basket');
  const screen = (
    <BasketScreen
      {...(slug !== undefined ? { slug } : {})}
      {...(editToken !== undefined ? { editToken } : {})}
      step={step}
      onBack={step === 'basket' ? onBack : () => setStep('basket')}
      onNext={() => setStep('name')}
      onChangePlace={() => setStep('pickup')}
      onToBasket={() => setStep('basket')}
      onPlaced={onPlaced}
      {...(onUpdated ? { onUpdated } : {})}
    />
  );
  return editToken !== undefined ? (
    <EditOrderFlow token={editToken}>{screen}</EditOrderFlow>
  ) : (
    screen
  );
}
