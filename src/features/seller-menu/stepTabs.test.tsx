import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerMenuI18n } from './i18n/register';
import { MenuScreen } from './MenuScreen';
import { menuReducer, type MenuData } from './menuSlice';

// Plan 053: a menu that is not published shows its steps as tabs, read-only, with Edit and Continue.

const text = (en: string) => ({ en, id: en });
const DATA = {
  view: {
    menu: {
      id: 'm1',
      state: 'not_published',
      cookingDate: '2026-10-17',
      cutoffAt: '2026-10-16T11:30:00.000Z',
      wizardStep: 2,
      delivery: { available: false, note: text('') },
    },
    dishes: [
      {
        id: 'i1',
        dishId: 'd1',
        name: text('Rendang'),
        description: text(''),
        size: text('1 box'),
        priceCents: 1500,
        limit: 20,
        chefId: 'wati',
      },
    ],
    pickupPoints: [{ id: 'p1', place: 'Glenelg', window: { start: '10:00', end: '12:00' } }],
  },
  dishes: [],
  sets: [],
  places: [],
  chefs: [{ id: 'wati', sellerId: 's1', name: 'Wati' }],
  prefs: { menuDefaults: {} },
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

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderMenu(url = '/seller/menu') {
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data: DATA, busy: false, result: null, seq: 0 },
    },
  });
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[url]}>
          <MenuScreen slots={{ newMenu: () => null, chefs: () => null }} />
          <Where />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
}

describe('Menu, not published: step tabs', () => {
  it('is a tab list that opens on the step the seller stopped at', () => {
    renderMenu();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
      '3 CheckYou stopped here',
    );
    expect(screen.getByRole('tab', { name: /1 Dishes/ })).toHaveTextContent('1 dish');
    expect(screen.getByRole('tab', { name: /4 Publish/ })).toHaveTextContent('To do');
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('shows each step read-only, by click and by arrow key', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('tab', { name: /1 Dishes/ }));
    expect(screen.getByText('Rendang')).toBeInTheDocument();
    expect(screen.getByText('Wati')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('2 Details');
    expect(screen.getByText(/Glenelg/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' });
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('4 Publish');
    expect(screen.getByText(/Not published yet/)).toBeInTheDocument();
  });

  it('Edit opens the wizard at the shown step; Continue at the first step not done', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('tab', { name: /2 Details/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    expect(screen.getByTestId('where').textContent).toBe('/seller/menu/make/details');
  });

  it('Continue opens the first step that is not done', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('tab', { name: /1 Dishes/ }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to step 3/ }));
    expect(screen.getByTestId('where').textContent).toBe('/seller/menu/make/check');
  });

  it('opens on the tab named by ?step=', () => {
    renderMenu('/seller/menu?step=details');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('2 Details');
  });
});
