import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { Provider, useSelector } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { DishEditor } from './DishEditor';
import { registerSellerMenuI18n } from './i18n/register';
import { menuReducer, type MenuData, type MenuRootState } from './menuSlice';

// Plan 056 stage 3 (one field per text) and plan 057 stage 2 (⇄ Translate) in the dish editor.

const state = vi.hoisted(() => ({ languages: 'both' }));
vi.mock('../../api/useSellerLanguages', () => ({ useSellerLanguages: () => state.languages }));
const translateText = vi.hoisted(() => vi.fn());
vi.mock('../../api/translate', () => ({ translateText }));

const DATA = {
  view: {
    menu: { id: 'm1', state: 'live', cookingDate: '2026-10-10', wizardStep: 4 },
    dishes: [],
    pickupPoints: [],
  },
  dishes: [],
  sets: [],
  places: [],
  chefs: [],
  prefs: {},
  past: [],
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
  state.languages = 'both';
  translateText.mockReset();
});

function show() {
  const seen: Array<unknown> = [];
  const spy: Middleware = () => (next) => (action) => {
    seen.push(action);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data: DATA, busy: false, result: null, seq: 0 },
    },
    middleware: (getDefault) => getDefault().concat(spy),
  });
  const Editor = () => (
    <DishEditor
      data={useSelector((s: MenuRootState) => s.sellerMenu.data) as MenuData}
      target={{ kind: 'library', dishId: null }}
      onClose={() => undefined}
    />
  );
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <MemoryRouter>
          <Editor />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
  return seen;
}

describe('dish editor languages', () => {
  it('shows one Name field for an id-only kitchen and saves the text into both', () => {
    state.languages = 'id';
    const seen = show();
    expect(screen.queryByLabelText('Name (English)')).toBeNull();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lemper' } });
    fireEvent.change(screen.getByLabelText('Price (AUD)'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add dish' }));
    expect(JSON.stringify(seen)).toContain('"name":{"en":"Lemper","id":"Lemper"}');
  });

  it('with both languages and only an Indonesian name, ⇄ From Indonesian fills the English one', async () => {
    translateText.mockResolvedValue({ ok: true, data: { text: 'Rice cake' } });
    show();
    fireEvent.change(screen.getByLabelText('Name (Indonesian)'), { target: { value: 'Lemper' } });
    fireEvent.click(screen.getByRole('button', { name: '⇄ From Indonesian' }));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>('Name (English)').value).toBe('Rice cake'),
    );
    expect(translateText).toHaveBeenCalledWith('Lemper', 'id', 'en');
  });
});
