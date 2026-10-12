import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerMenuI18n } from './i18n/register';
import { menuReducer, opRequested, type MenuData } from './menuSlice';
import { PublishStep } from './PublishStep';

// Plan 055: Publish opens a modal; the choice (take orders now / paused) goes with the request.

const DATA = {
  view: {
    menu: {
      id: 'm1',
      state: 'not_published',
      cookingDate: '2026-10-17',
      cutoffAt: '2026-10-16T11:30:00.000Z',
      delivery: { available: false, note: { en: '', id: '' } },
      takingOrders: true,
    },
    dishes: [],
    pickupPoints: [],
  },
} as unknown as MenuData;

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

function renderStep() {
  const sent: Array<unknown> = [];
  const spy: Middleware = () => (next) => (action) => {
    if (opRequested.match(action)) sent.push(action.payload);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data: DATA, busy: false, result: null, seq: 0 },
    },
    middleware: (defaults) => defaults().concat(spy),
  });
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <PublishStep
          data={DATA}
          lang="en"
          onGoToOrders={() => undefined}
          renderShare={() => null}
        />
      </AppThemeProvider>
    </Provider>,
  );
  return sent;
}

describe('Publish choice', () => {
  it('opens a modal; Cancel publishes nothing', () => {
    const sent = renderStep();
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Publish the menu for');
    expect(screen.getByRole('radio', { name: /take orders now/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent).toEqual([]);
  });

  it('publishes with orders open by default', () => {
    const sent = renderStep();
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish and open orders' }));
    expect(sent).toEqual([{ kind: 'publish', takingOrders: true }]);
  });

  it('publishes with ordering paused when that is chosen', () => {
    const sent = renderStep();
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    fireEvent.click(screen.getByRole('radio', { name: /ordering paused/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish, paused' }));
    expect(sent).toEqual([{ kind: 'publish', takingOrders: false }]);
  });
});
