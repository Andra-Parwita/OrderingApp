import { configureStore, type UnknownAction } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { MenuScreen } from './MenuScreen';
import { registerSellerMenuI18n } from './i18n/register';
import { menuReducer, type MenuData } from './menuSlice';

// Plan 030 stage 2: a chef's Menu shows their own dishes only, and the editor has no chef picker.

const text = (en: string) => ({ en, id: en });
const dish = (id: string, name: string, chefId?: string) => ({
  id,
  name: text(name),
  description: text(''),
  size: text('1 portion'),
  priceCents: 1000,
  ...(chefId ? { chefId } : {}),
});

const DATA = {
  view: {
    menu: { id: 'm1', state: 'live', cookingDate: '2026-10-10', wizardStep: 4 },
    dishes: [
      { ...dish('i1', 'Lemper', 'wati'), dishId: 'd1', soldOut: false, remaining: null },
      { ...dish('i2', 'Rendang', 'rudi'), dishId: 'd2', soldOut: false, remaining: null },
    ],
    pickupPoints: [],
  },
  dishes: [dish('d1', 'Lemper', 'wati'), dish('d2', 'Rendang', 'rudi'), dish('d3', 'Soto')],
  sets: [],
  places: [],
  chefs: [
    { id: 'wati', sellerId: 's1', name: 'Wati' },
    { id: 'rudi', sellerId: 's1', name: 'Rudi' },
  ],
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

function renderChef() {
  const actions: Array<UnknownAction> = [];
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data: DATA, busy: false, result: null, seq: 0 },
    },
    middleware: (getDefault) =>
      getDefault({ thunk: false }).concat(() => (next) => (action) => {
        actions.push(action as UnknownAction);
        return next(action);
      }),
  });
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <MemoryRouter>
          <MenuScreen slots={{ newMenu: () => null }} chefId="wati" />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
  return actions;
}

describe('chef Menu (plan 030)', () => {
  it("shows only the chef's own dishes, with no owner controls", () => {
    renderChef();
    expect(screen.getByText('Lemper')).toBeInTheDocument();
    expect(screen.queryByText('Rendang')).toBeNull();
    expect(screen.queryByText('Soto')).toBeNull();
    expect(screen.queryByText(/New menu|Past menus|Saved sets/)).toBeNull();
    expect(screen.getByRole('switch', { name: 'Sold out: Lemper' })).toBeInTheDocument();
  });

  it('opens the editor without a chef picker and adds a dish without a chefId', () => {
    const actions = renderChef();
    fireEvent.click(screen.getByRole('button', { name: /New dish/ }));
    expect(screen.queryByLabelText('Chef')).toBeNull();
    expect(screen.queryByText('Add to this menu too')).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Name (English)'), { target: { value: 'Pastel' } });
    fireEvent.change(screen.getByLabelText('Price (AUD)'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add dish' }));
    const op = actions.find((a) => a.type.includes('opRequested')) as
      | { payload: { kind: string; addToMenu: boolean; request: Record<string, unknown> } }
      | undefined;
    expect(op?.payload.kind).toBe('createDish');
    expect(op?.payload.addToMenu).toBe(false);
    expect(op?.payload.request).not.toHaveProperty('chefId');
  });
});
