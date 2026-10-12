import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Language, Languages } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { markLanguageChosen } from '../../i18n/chosenLanguage';
import en from '../../i18n/en.json';
import id from '../../i18n/id.json';
import { customerReducer } from './customerSlice';
import { useForcedKitchenLanguage, useKitchenLanguages } from './kitchenLanguage';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, id: { translation: id } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  // The app remembers every language change (src/i18n/init.ts); the hook must undo that.
  i18n.on('languageChanged', (language) => localStorage.setItem('lang', language));
});
afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
});

function Probe() {
  useForcedKitchenLanguage();
  return <output>{useKitchenLanguages()}</output>;
}

function show(languages: Languages | undefined, firstLanguage?: Language) {
  const base = customerReducer(undefined, { type: 'init' });
  const data = {
    ...(languages === undefined ? {} : { languages }),
    ...(firstLanguage === undefined ? {} : { firstLanguage }),
  } as MenuResponse;
  const store = configureStore({
    reducer: { customer: customerReducer },
    preloadedState: { customer: { ...base, menu: { status: 'ready' as const, data } } },
  });
  render(
    <Provider store={store}>
      <Probe />
    </Provider>,
  );
}

describe('a kitchen that offers one language (plan 056)', () => {
  it('forces Indonesian for an id-only kitchen', async () => {
    show('id');
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('id');
    await waitFor(() => expect(i18n.language).toBe('id'));
  });

  it('forces English for an en-only kitchen that the phone shows in Indonesian', async () => {
    await i18n.changeLanguage('id');
    show('en');
    await waitFor(() => expect(i18n.language).toBe('en'));
  });

  it('does not overwrite the saved choice that the seller app shares (id-only kitchen, saved en)', async () => {
    localStorage.setItem('lang', 'en');
    show('id');
    await waitFor(() => expect(i18n.language).toBe('id'));
    await waitFor(() => expect(localStorage.getItem('lang')).toBe('en'));
  });

  it('leaves the language alone for both, and for an older server that sends nothing', async () => {
    await i18n.changeLanguage('id');
    show('both');
    show(undefined);
    expect(i18n.language).toBe('id');
  });
});

describe('the language customers see first (plan 060)', () => {
  it('first visit: shows the kitchen first language, and leaves the saved lang key alone', async () => {
    localStorage.setItem('lang', 'en');
    show('both', 'id');
    await waitFor(() => expect(i18n.language).toBe('id'));
    await waitFor(() => expect(localStorage.getItem('lang')).toBe('en'));
  });

  it('after the customer switched language, their choice wins', () => {
    markLanguageChosen();
    show('both', 'id');
    expect(i18n.language).toBe('en');
  });

  it('without a first language from the server (not chosen), keeps the phone language', async () => {
    await i18n.changeLanguage('id');
    show('both');
    expect(i18n.language).toBe('id');
  });
});
