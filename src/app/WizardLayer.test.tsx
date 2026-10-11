import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Menu, MenuView } from '../../shared/menusContract';
import { registerSellerHomeI18n } from '../features/seller-home';
import { registerSellerMenuI18n } from '../features/seller-menu';
import { registerSellerI18n } from '../features/seller-orders';
import { registerShareI18n } from '../features/seller-share';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { AppRoutes } from './AppRoutes';
import { createAppStore } from './store';

// Plan 037: the menu wizard is a layer over the screen it was opened from.

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

function renderAt(path: string) {
  return render(
    <Provider store={createAppStore()}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <Where />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
}

const DEFAULTS = {
  cutoffDaysBefore: 1,
  cutoffTime: '20:00',
  delivery: { available: false, note: { en: 'n', id: 'n' } },
};

function menu(over: Partial<Menu>): Menu {
  return {
    id: 'm1',
    state: 'not_published',
    cookingDate: '2026-10-17',
    cutoffAt: '2026-10-15T20:00:00+11:00',
    delivery: { available: false, note: { en: '', id: '' } },
    wizardStep: 0,
    takingOrders: true,
    placeUses: [],
    ...over,
  };
}

let current: MenuView;
let puts: Array<unknown>;

function json(body: unknown) {
  return Promise.resolve(Response.json(body));
}

function stubServer() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        'http://x',
      ).pathname;
      const method = init?.method ?? 'GET';
      if (url === '/api/seller/menus' && method === 'POST') {
        current = { ...current, menu: menu({ state: 'not_published', wizardStep: 0 }) };
        return json({ menu: current });
      }
      if (url === '/api/seller/menus/current' && method === 'PUT') {
        const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Partial<Menu>;
        puts.push(body);
        current = { ...current, menu: { ...current.menu, ...body } };
        return json({ menu: current, warnings: { removedWithOrders: [] } });
      }
      if (url === '/api/seller/menus/current') return json({ menu: current });
      if (url === '/api/seller/dishes') return json({ dishes: [] });
      if (url === '/api/seller/saved-sets') return json({ sets: [] });
      if (url === '/api/seller/pickup-places') return json({ places: [] });
      if (url === '/api/seller/chefs') return json({ chefs: [] });
      if (url === '/api/seller/past-weeks') return json({ weeks: [] });
      if (url === '/api/seller/preferences') {
        return json({ preferences: { theme: 'onde', menuDefaults: DEFAULTS } });
      }
      return Promise.resolve(Response.json({ error: 'not_found' }, { status: 404 }));
    }),
  );
}

let wide = true;

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('min-width') ? wide : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerSellerI18n();
  registerSellerMenuI18n();
  registerSellerHomeI18n();
  registerShareI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  wide = true;
  puts = [];
  current = { menu: menu({ wizardStep: 1 }), dishes: [], pickupPoints: [] };
  stubServer();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

const rail = () => screen.getByRole('navigation', { name: 'Seller' });
const closeButton = () =>
  within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' })[0]!;

describe('menu wizard layer', () => {
  it('opens from Home over Home: Home stays lit, Next keeps the layer, Close returns to Home', async () => {
    renderAt('/seller');
    // Continue opens the saved step (wizardStep 1 = Details).
    fireEvent.click(
      await screen.findByRole('button', { name: /Continue making it/ }, { timeout: 5000 }),
    );
    const layer = await screen.findByRole('dialog', { name: 'Make a menu' });
    expect(screen.getByTestId('where')).toHaveTextContent('/seller/menu/make/details');
    expect(within(rail()).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(rail()).getByRole('link', { name: 'Menu' })).not.toHaveAttribute('aria-current');
    // Home is still rendered behind the layer.
    expect(screen.getAllByRole('button', { name: /Continue making it/ }).length).toBeGreaterThan(0);

    fireEvent.click(await within(layer).findByRole('button', { name: /Next: / }));
    expect(screen.getByTestId('where')).toHaveTextContent('/seller/menu/make/check');
    expect(screen.getByRole('dialog', { name: 'Make a menu' })).toBeInTheDocument();
    expect(within(rail()).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    fireEvent.click(closeButton());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/seller$/);
  });

  it('closes on Escape', async () => {
    renderAt('/seller');
    fireEvent.click(
      await screen.findByRole('button', { name: /Continue making it/ }, { timeout: 5000 }),
    );
    const layer = await screen.findByRole('dialog', { name: 'Make a menu' });
    fireEvent.keyDown(layer, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/seller$/);
  });

  it('shows a direct link over the Menu screen, and Close goes to Menu', async () => {
    renderAt('/seller/menu/make/dishes');
    expect(await screen.findByRole('dialog', { name: 'Make a menu' })).toBeInTheDocument();
    expect(within(rail()).getByRole('link', { name: 'Menu' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(closeButton());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/seller\/menu$/);
  });

  it('opens Dishes from Make-menu on Home with no tab change', async () => {
    current = {
      menu: menu({ state: 'finished', finishedAt: '2026-10-11T10:00:00Z' }),
      dishes: [],
      pickupPoints: [],
    };
    renderAt('/seller');
    // No earlier menu: Home offers "Make a menu" (the first-time layout).
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Make a menu' }, { timeout: 5000 }))[0]!,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Create menu' }));
    expect(
      await screen.findByRole('dialog', { name: 'Make a menu' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/seller/menu/make/dishes');
    expect(within(rail()).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(puts.length).toBeGreaterThan(0);
  });
});
