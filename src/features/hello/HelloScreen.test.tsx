import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { HelloScreen } from './HelloScreen';
import { helloSaga } from './helloSaga';
import { helloReducer } from './helloSlice';

function renderScreen() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { hello: helloReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(helloSaga);
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <HelloScreen />
      </AppThemeProvider>
    </Provider>,
  );
}

describe('HelloScreen', () => {
  beforeAll(async () => {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList;
    await initI18n();
  });

  it('shows the app name and the health result from MSW', async () => {
    renderScreen();
    expect(screen.getByRole('heading', { name: 'Weekly Menu' })).toBeInTheDocument();
    expect(await screen.findByText('ok')).toBeInTheDocument();
  });

  it('switches the visible text to Indonesian', async () => {
    renderScreen();
    await screen.findByText('ok');
    fireEvent.click(screen.getByRole('button', { name: 'ID' }));
    expect(await screen.findByRole('heading', { name: 'Menu Mingguan' })).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});
