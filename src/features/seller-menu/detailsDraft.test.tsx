import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftKey } from '../../components/draft';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { DetailsStep } from './DetailsStep';
import { registerSellerMenuI18n } from './i18n/register';
import { menuReducer, type MenuData } from './menuSlice';

// Plan 061 stage 4: the wizard's free text (delivery note, a pickup place) survives a reload.

vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));

const DATA = {
  view: {
    menu: {
      id: 'm1',
      state: 'draft',
      cookingDate: '2026-10-17',
      cutoffAt: '2026-10-15T20:00:00+10:00',
      delivery: { available: true, note: { en: 'Saved note', id: '' } },
      placeUses: [],
      wizardStep: 2,
    },
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
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

function mount() {
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data: DATA, busy: false, result: null, seq: 0 },
    },
  });
  return render(
    <Provider store={store}>
      <AppThemeProvider>
        <DetailsStep data={DATA} lang="en" />
      </AppThemeProvider>
    </Provider>,
  );
}

describe('wizard details draft', () => {
  it('restores a half-typed delivery note and clears it when it is saved (blur)', () => {
    const first = mount();
    const field = () =>
      screen
        .getAllByRole('textbox')
        .find((e) => (e as HTMLTextAreaElement).value === 'Saved note')!;
    fireEvent.change(field(), { target: { value: 'Saved note, half typ' } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(localStorage.getItem(draftKey('home', 'wizard-note', 'm1'))).not.toBeNull();
    first.unmount();
    mount();
    expect(screen.getByDisplayValue('Saved note, half typ')).toBeInTheDocument();
    expect(screen.getByText('Restored what you typed')).toBeInTheDocument();
    fireEvent.blur(screen.getByDisplayValue('Saved note, half typ'));
    expect(localStorage.getItem(draftKey('home', 'wizard-note', 'm1'))).toBeNull();
  });

  it('restores a half-typed pickup place; Cancel forgets it', () => {
    const first = mount();
    // Delivery with no place hides the places; Both shows them.
    fireEvent.click(screen.getByRole('radio', { name: 'Both' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const place = screen.getByLabelText('Place');
    fireEvent.change(place, { target: { value: 'Front gate' } });
    first.unmount();
    mount();
    fireEvent.click(screen.getByRole('radio', { name: 'Both' }));
    expect(screen.getByDisplayValue('Front gate')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(localStorage.getItem(draftKey('home', 'wizard-place', 'm1'))).toBeNull();
  });
});
