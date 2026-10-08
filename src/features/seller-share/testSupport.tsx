import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerShareI18n } from './i18n/register';
import { shareSaga } from './shareSaga';
import { shareReducer } from './shareSlice';
import type { ShareMenu, ShareSettings } from './shareText';

/** Test-only helpers shared by this feature's tests. */
const none = { en: '', id: '' };

export const MENU: ShareMenu = {
  cookingDate: '2026-10-10',
  cutoffAt: '2026-10-09T21:00:00+11:00',
  pickupPoints: [
    {
      id: 'gw',
      place: 'Glen Waverley',
      directions: none,
      window: { start: '14:00', end: '17:00' },
    },
  ],
  delivery: { available: true, note: none },
  items: [
    {
      name: { en: 'Lime-leaf mixed rice', id: 'Nasi campur daun jeruk' },
      description: { en: 'with fried chicken', id: 'lauk: ayam goreng' },
      size: { en: '1 box', id: '1 box' },
      priceCents: 1500,
    },
    {
      name: { en: 'Thin battered tempeh', id: 'Tempe mendoan' },
      description: none,
      size: { en: '4 pieces', id: '4 biji' },
      priceCents: 1250,
    },
  ],
};

export const SETTINGS: ShareSettings = {
  whatsappNumber: '61412345678',
  postGreeting: { en: 'Hi everyone!', id: 'Halo semuanya!' },
  postClosing: {
    en: 'Questions? WhatsApp me on {phone}',
    id: 'Ada pertanyaan? WhatsApp {phone}',
  },
};

export function createTestStore(options: { saga: boolean }) {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerShare: shareReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  if (options.saga) sagaMiddleware.run(shareSaga);
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
  registerShareI18n();
  await i18n.changeLanguage('en');
}

export function renderWithStore(ui: ReactNode, store: TestStore) {
  return render(
    <Provider store={store}>
      <AppThemeProvider>{ui}</AppThemeProvider>
    </Provider>,
  );
}
