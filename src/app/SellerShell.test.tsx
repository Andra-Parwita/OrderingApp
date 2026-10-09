import { render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Me } from '../../shared/authContract';
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
            <Route index element={<p>Orders page</p>} />
            <Route path="cook" element={<p>Cook page</p>} />
            <Route path="hand-over" element={<p>Hand-over page</p>} />
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
  it('lists Orders, Kitchen, Pickup & delivery, Menu and Settings for the seller', () => {
    me = SELLER;
    renderAt('/seller');
    const nav = screen.getByRole('navigation', { name: 'Seller' });
    expect(linkNames(nav).map((text) => text?.replace('Not published', ''))).toEqual([
      'Orders',
      'Kitchen',
      'Pickup & delivery',
      'Menu',
      'Settings',
    ]);
    expect(within(nav).getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows no Menu and no Settings to a chef', () => {
    me = CHEF;
    renderAt('/seller');
    const nav = screen.getByRole('navigation', { name: 'Seller' });
    expect(linkNames(nav)).toEqual(['Orders', 'Kitchen', 'Pickup & delivery']);
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
      'Pesanan',
      'Dapur',
      'Serah terima',
      'Menu',
      'Pengaturan',
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

  it('says "Open this on a tablet or computer" instead of the Kitchen', () => {
    tablet = false;
    me = SELLER;
    renderAt('/seller/cook');
    expect(
      screen.getByRole('heading', { name: 'Open this on a tablet or computer' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Cook page')).not.toBeInTheDocument();
  });

  it('shows the Kitchen page itself on a tablet', () => {
    me = SELLER;
    renderAt('/seller/cook');
    expect(screen.getByText('Cook page')).toBeInTheDocument();
  });

  it('has the Indonesian tablet-only page', async () => {
    await i18n.changeLanguage('id');
    tablet = false;
    me = SELLER;
    renderAt('/seller/cook');
    expect(
      screen.getByRole('heading', { name: 'Buka ini di tablet atau komputer' }),
    ).toBeInTheDocument();
  });
});
