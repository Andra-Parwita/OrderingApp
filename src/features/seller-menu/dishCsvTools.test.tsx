import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISH_CSV_HEADER } from '../../../shared/dishCsv';
import type { Dish } from '../../../shared/menusContract';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { DishCsvTools } from './DishCsvTools';
import { registerSellerMenuI18n } from './i18n/register';
import { menuReducer } from './menuSlice';

// Plan 050 stage 3: Import (preview, then apply), Export CSV.

const importDishes = vi.hoisted(() => vi.fn());
vi.mock('../../api/menus', () => ({ importDishes }));

const FILE = [
  DISH_CSV_HEADER.join(','),
  'Lumpia,,,,1 box,5.00,,,yes,',
  'Risoles,,,,1 box,4.50,,,yes,',
  'Broken,,,,1 box,abc,,,yes,',
].join('\n');

const dish = {
  id: 'd1',
  name: { en: 'Soto', id: 'Soto' },
  description: { en: '', id: '' },
  size: { en: '1 bowl', id: '1 bowl' },
  priceCents: 1250,
} as unknown as Dish;

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
beforeEach(() => importDishes.mockReset());

function renderTools() {
  const store = configureStore({ reducer: { sellerMenu: menuReducer } });
  const { container } = render(
    <Provider store={store}>
      <AppThemeProvider>
        <DishCsvTools dishes={[dish]} chefs={[]} />
      </AppThemeProvider>
    </Provider>,
  );
  return container;
}

const answer = (applied: boolean) => ({
  ok: true,
  data: {
    applied,
    overLimit: false,
    counts: { new: 2, update: 0, error: 0 },
    rows: [
      { status: 'new', name: 'Lumpia' },
      { status: 'new', name: 'Risoles' },
    ],
  },
});

describe('dish CSV tools', () => {
  it('previews a 3-row file as 2 new and 1 problem, then Import applies it', async () => {
    importDishes.mockResolvedValueOnce(answer(false)).mockResolvedValueOnce(answer(true));
    const container = renderTools();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([FILE], 'dishes.csv', { type: 'text/csv' })] },
    });
    expect(await screen.findByText('2 new, 0 to update, 1 with a problem')).toBeInTheDocument();
    expect(screen.getByText('The price is not a number such as 12.50.')).toBeInTheDocument();
    expect(importDishes.mock.calls[0]?.[0]).toMatchObject({ apply: false });
    expect((importDishes.mock.calls[0]?.[0] as { rows: Array<unknown> }).rows).toHaveLength(2);
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Import dishes' })).getByRole('button', {
        name: 'Import',
      }),
    );
    await waitFor(() => expect(importDishes).toHaveBeenCalledTimes(2));
    expect(importDishes.mock.calls[1]?.[0]).toMatchObject({ apply: true });
  });

  it('Export CSV downloads the same columns', async () => {
    const blobs: Array<Blob> = [];
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:x';
    };
    URL.revokeObjectURL = () => undefined;
    renderTools();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    const text = (await blobs[0]?.text()) ?? '';
    expect(text.replace('﻿', '').split('\r\n')[0]).toBe(DISH_CSV_HEADER.join(','));
    expect(text).toContain('Soto');
  });
});
