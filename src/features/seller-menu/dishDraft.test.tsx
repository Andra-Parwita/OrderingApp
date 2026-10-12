import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { Provider, useSelector } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftKey } from '../../components/draft';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { DishEditor, type DishTarget } from './DishEditor';
import { registerSellerMenuI18n } from './i18n/register';
import { menuReducer, opDone, type MenuData, type MenuRootState } from './menuSlice';

// Plan 061 stage 2: the dish editor keeps what was typed until Save or Discard.

vi.mock('../../api/useSellerLanguages', () => ({ useSellerLanguages: () => 'both' }));
vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));

const dish = (price: number) => ({
  id: 'd1',
  name: { en: 'Lemper', id: 'Lemper' },
  description: { en: '', id: '' },
  size: { en: '', id: '' },
  priceCents: price,
  preorder: true,
});
const dataWith = (price: number) =>
  ({
    view: {
      menu: { id: 'm1', state: 'live', cookingDate: '2026-10-10', wizardStep: 4 },
      dishes: [],
      pickupPoints: [],
    },
    dishes: [dish(price)],
    sets: [],
    places: [],
    chefs: [],
    prefs: {},
    past: [],
  }) as unknown as MenuData;

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
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

function mount(target: DishTarget, data: MenuData, onClose = () => undefined) {
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data, busy: false, result: null, seq: 0 },
    },
  });
  const Editor = () => (
    <DishEditor
      data={useSelector((s: MenuRootState) => s.sellerMenu.data) as MenuData}
      target={target}
      onClose={onClose}
    />
  );
  const view = render(
    <Provider store={store}>
      <AppThemeProvider>
        <MemoryRouter>
          <Editor />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
  return { store, ...view };
}
const NEW: DishTarget = { kind: 'library', dishId: null };
const EDIT: DishTarget = { kind: 'library', dishId: 'd1' };
const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  act(() => {
    vi.advanceTimersByTime(500);
  });
};

describe('dish editor draft', () => {
  it('restores a new dish after a reload and says so', () => {
    const first = mount(NEW, dataWith(500));
    type('Name (English)', 'Risoles');
    first.unmount();
    mount(NEW, dataWith(500));
    expect(screen.getByLabelText<HTMLInputElement>('Name (English)').value).toBe('Risoles');
    expect(screen.getByText('Restored what you typed')).toBeInTheDocument();
  });

  it('restores an edited dish, kept apart from the new-dish draft', () => {
    const first = mount(EDIT, dataWith(500));
    type('Price (AUD)', '7.50');
    first.unmount();
    expect(localStorage.getItem(draftKey('home', 'dish', 'd1'))).not.toBeNull();
    expect(localStorage.getItem(draftKey('home', 'dish', 'new'))).toBeNull();
    mount(EDIT, dataWith(500));
    expect(screen.getByLabelText<HTMLInputElement>('Price (AUD)').value).toBe('7.50');
  });

  it('Discard in the notice resets to the saved values and forgets the draft', () => {
    const first = mount(EDIT, dataWith(500));
    type('Price (AUD)', '7.50');
    first.unmount();
    mount(EDIT, dataWith(500));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByLabelText<HTMLInputElement>('Price (AUD)').value).toBe('5.00');
    expect(localStorage.getItem(draftKey('home', 'dish', 'd1'))).toBeNull();
  });

  it('Save clears the draft once the server accepts', () => {
    const view = mount(EDIT, dataWith(500));
    type('Price (AUD)', '7.50');
    expect(localStorage.getItem(draftKey('home', 'dish', 'd1'))).not.toBeNull();
    act(() => {
      view.store.dispatch(opDone({ kind: 'updateDish' }));
    });
    expect(localStorage.getItem(draftKey('home', 'dish', 'd1'))).toBeNull();
  });

  it('closing with the X keeps the draft; "Close and keep draft" keeps it; Discard clears it', () => {
    const onClose = vi.fn();
    mount(NEW, dataWith(500), onClose);
    type('Name (English)', 'Risoles');
    const key = draftKey('home', 'dish', 'new');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close and keep draft' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(key)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('asks Keep my version / Use the saved version when the dish changed on the server', () => {
    const first = mount(EDIT, dataWith(500));
    type('Price (AUD)', '7.50');
    first.unmount();
    mount(EDIT, dataWith(600));
    expect(screen.getByText('This changed since you started typing.')).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>('Price (AUD)').value).toBe('7.50');
    fireEvent.click(screen.getByRole('button', { name: 'Use the saved version' }));
    expect(screen.getByLabelText<HTMLInputElement>('Price (AUD)').value).toBe('6.00');
  });

  it('ignores a draft older than 7 days', () => {
    const first = mount(NEW, dataWith(500));
    type('Name (English)', 'Old');
    first.unmount();
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    mount(NEW, dataWith(500));
    expect(screen.getByLabelText<HTMLInputElement>('Name (English)').value).toBe('');
  });
});
