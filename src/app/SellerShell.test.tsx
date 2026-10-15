import { render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Me } from '../../shared/authContract';
import { registerSellerHelpI18n } from '../features/seller-help';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { SellerLayout } from './SellerLayout';

let me: Me | null = null;
let tablet = true;
vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  // The Menu badge asks for today's menu; a draft week is 'not_published'.
  fetchCurrentMenu: () =>
    Promise.resolve({ ok: true, data: { menu: { menu: { state: 'not_published' } } } } as never),
}));
vi.mock('./session', () => ({
  useSession: () => ({ me, end: () => Promise.resolve() }),
}));

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query.includes('min-width') ? tablet : false;
      },
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerSellerHelpI18n();
});

afterEach(async () => {
  me = null;
  tablet = true;
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
});

const SELLER: Me = { role: 'seller', stage: 'full', sellerName: 'Delave' };
const CHEF: Me = { role: 'chef', stage: 'full', sellerName: 'Delave', chefName: 'Rina' };

function renderAt(path: string) {
  // Week "draft" for the not-published badge; every other call gets an empty answer.
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url.includes('/api/seller/week')
          ? Response.json({ week: { status: 'draft' } })
          : Response.json({}),
      ),
    ),
  );
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/seller" element={<SellerLayout />}>
            <Route index element={<p>Home page</p>} />
            <Route path="orders" element={<p>Orders page</p>} />
            <Route path="cook" element={<p>Cook page</p>} />
            <Route path="menu" element={<p>Menu page</p>} />
            <Route path="hand-over" element={<p>Hand-over page</p>} />
            <Route path="devices" element={<p>Devices page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

const linkNames = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('seller shell, tablet', () => {
  it('lists Home, Orders, Kitchen, Pickup & delivery, Sell, Menu and Settings for the seller', () => {
    me = SELLER;
    renderAt('/seller');
    const nav = screen.getByRole('navigation', { name: 'Seller' });
    expect(linkNames(nav).map((text) => text?.replace('Not published', ''))).toEqual([
      'Home',
      'Orders',
      'Kitchen',
      'Pickup & delivery',
      'Sell',
      'Menu',
      'Settings',
      'Help',
      'About',
    ]);
    // /seller is Home on a tablet; Orders is /seller/orders.
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'href',
      '/seller/orders',
    );
  });

  it('marks Orders, not Home, on /seller/orders', () => {
    me = SELLER;
    renderAt('/seller/orders');
    const nav = screen.getByRole('navigation', { name: 'Seller' });
    expect(within(nav).getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('shows Menu (own dishes) but no Settings to a chef', () => {
    me = CHEF;
    renderAt('/seller');
    const nav = screen.getByRole('navigation', { name: 'Seller' });
    expect(linkNames(nav)).toEqual([
      'Orders',
      'Kitchen',
      'Pickup & delivery',
      'Menu',
      'Help',
      'About',
    ]);
  });

  it('shows a helper only Orders, Pickup & delivery and Sell', () => {
    me = { role: 'helper', stage: 'full', sellerName: 'Delave', displayName: 'Dewi' };
    renderAt('/seller/orders');
    const nav = screen.getByRole('navigation', { name: 'Seller' });
    expect(linkNames(nav)).toEqual(['Orders', 'Pickup & delivery', 'Sell', 'Help', 'About']);
  });

  it('marks Menu "Not published" with a word while the week is a draft', async () => {
    me = SELLER;
    renderAt('/seller');
    expect(await screen.findByText('Not published')).toBeInTheDocument();
  });

  it('uses the Indonesian labels', async () => {
    await i18n.changeLanguage('id');
    me = SELLER;
    renderAt('/seller');
    const nav = screen.getByRole('navigation', { name: 'Penjual' });
    expect(linkNames(nav).map((text) => text?.replace('Belum terbit', ''))).toEqual([
      'Beranda',
      'Pesanan',
      'Dapur',
      'Serah terima',
      'Jual',
      'Menu',
      'Pengaturan',
      'Bantuan',
      'Tentang',
    ]);
  });

  it('keeps Switch person, EN/ID and Collapse at the foot', () => {
    me = SELLER;
    renderAt('/seller');
    expect(screen.getByRole('button', { name: 'Switch person' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse menu' })).toBeInTheDocument();
  });
});

describe('seller shell, phone', () => {
  it('has a bottom bar with Orders, Pickup & delivery and More', () => {
    tablet = false;
    me = SELLER;
    renderAt('/seller');
    const bar = screen.getByRole('navigation', { name: 'Seller (phone)' });
    expect(linkNames(bar)).toEqual(['Orders', 'Pickup & delivery', 'More']);
    expect(screen.queryByRole('navigation', { name: 'Seller' })).not.toBeInTheDocument();
  });

  it('says "Open this on a tablet or computer" instead of the Menu', () => {
    tablet = false;
    me = SELLER;
    renderAt('/seller/menu');
    expect(
      screen.getByRole('heading', { name: 'Open this on a tablet or computer' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Menu page')).not.toBeInTheDocument();
  });

  it('shows Devices on a phone, not the tablet-only note (D-097)', () => {
    tablet = false;
    me = SELLER;
    renderAt('/seller/devices');
    expect(screen.getByText('Devices page')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Open this on a tablet or computer' }),
    ).not.toBeInTheDocument();
  });

  it('shows the Kitchen page itself on a tablet', () => {
    me = SELLER;
    renderAt('/seller/cook');
    expect(screen.getByText('Cook page')).toBeInTheDocument();
  });

  it('shows the Kitchen page on a phone too (plan 035)', () => {
    tablet = false;
    me = SELLER;
    renderAt('/seller/cook');
    expect(screen.getByText('Cook page')).toBeInTheDocument();
  });

  it('has the Indonesian tablet-only page', async () => {
    await i18n.changeLanguage('id');
    tablet = false;
    me = SELLER;
    renderAt('/seller/menu');
    expect(
      screen.getByRole('heading', { name: 'Buka ini di tablet atau komputer' }),
    ).toBeInTheDocument();
  });
});
