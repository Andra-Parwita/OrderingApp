import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerMenuI18n } from './i18n/register';
import { menuReducer, opDone, opFailed, opRequested, type MenuData } from './menuSlice';
import { PublishStep } from './PublishStep';

const api = vi.hoisted(() => ({ status: vi.fn(), send: vi.fn() }));
vi.mock('../../api/menuNotices', () => ({
  fetchMenuNoticeStatus: api.status,
  sendMenuNotice: api.send,
}));

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

const LIVE = {
  view: { ...DATA.view, menu: { ...DATA.view.menu, state: 'live' } },
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

beforeEach(() => {
  api.status.mockReset();
  api.send.mockReset();
  api.status.mockResolvedValue({ ok: false, error: 'x', status: 500, message: '' });
});

function renderStep(live = false) {
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
          data={live ? LIVE : DATA}
          lang="en"
          onGoToOrders={() => undefined}
          renderShare={() => null}
        />
      </AppThemeProvider>
    </Provider>,
  );
  return { sent, store };
}

describe('Publish choice', () => {
  it('opens a modal; Cancel publishes nothing', () => {
    const { sent } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Publish the menu for');
    expect(screen.getByRole('radio', { name: /take orders now/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent).toEqual([]);
  });

  it('publishes with orders open by default', () => {
    const { sent } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish and open orders' }));
    expect(sent).toEqual([{ kind: 'publish', takingOrders: true }]);
  });

  it('publishes with ordering paused when that is chosen', () => {
    const { sent } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    fireEvent.click(screen.getByRole('radio', { name: /ordering paused/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish, paused' }));
    expect(sent).toEqual([{ kind: 'publish', takingOrders: false }]);
  });

  describe('plan 133: the question after Publish', () => {
    const ASK = 'Send a notification to customers who already have the app?';
    const done = (store: ReturnType<typeof renderStep>['store']) =>
      act(() => {
        store.dispatch(opDone({ kind: 'publish' }));
      });

    it('is asked after a successful publish; Not now sends nothing', () => {
      const { store } = renderStep();
      expect(screen.queryByText(ASK)).toBeNull();
      done(store);
      expect(screen.getByRole('dialog', { name: ASK })).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
      expect(screen.queryByText(ASK)).toBeNull();
      expect(api.send).not.toHaveBeenCalled();
    });

    it('is not asked after a failed publish', () => {
      const { store } = renderStep();
      act(() => {
        store.dispatch(opFailed({ kind: 'publish', code: 'x', message: 'x' }));
      });
      expect(screen.queryByText(ASK)).toBeNull();
    });

    it('is also shown on the live page; Send calls the existing send once and closes', async () => {
      api.send.mockResolvedValue({ ok: true, data: { sends: [], canSend: true } });
      const { store } = renderStep(true);
      done(store);
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(screen.queryByText(ASK)).toBeNull());
      expect(api.send).toHaveBeenCalledTimes(1);
      expect(api.send.mock.calls[0]?.[0]).toBe(false);
    });

    it('a failed send shows the error and keeps the question', async () => {
      api.send.mockResolvedValue({ ok: false, error: 'x', status: 500, message: '' });
      const { store } = renderStep();
      done(store);
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not send. Try again.');
      expect(screen.getByText(ASK)).toBeVisible();
    });
  });
});
