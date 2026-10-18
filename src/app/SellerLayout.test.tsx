import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { useEffect, useState } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import type { Me } from '../../shared/authContract';
import { SellerLayout } from './SellerLayout';
import { SessionProvider, useSession } from './session';

// A matchMedia whose "(min-width: …)" answer can be flipped while the page is open.
let wide = false;
const listeners = new Set<() => void>();

function setWide(next: boolean): void {
  wide = next;
  act(() => listeners.forEach((listener) => listener()));
}

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query.includes('min-width') ? wide : false;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }) as unknown as MediaQueryList;
  await initI18n();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  wide = false;
  listeners.clear();
  vi.unstubAllGlobals();
});

const KITCHEN = {
  sellerId: 's1',
  name: 'Delave',
  tagline: { en: 'a', id: 'b' },
  images: {
    desktopBanner: '/samples/banner-wide.jpg',
    phoneBanner: '/samples/banner-phone.jpg',
    bannerBackground: '#835937',
    bannerBackgroundImage: '/samples/banner-bg.jpg',
    alt: { en: 'Onde Onde banner', id: 'Banner Onde Onde' },
  },
};

function stubKitchen(kitchen: Record<string, unknown> = KITCHEN) {
  const menu = {
    seller: { id: 's1', slug: 'onde-onde', name: 'Delave' },
    kitchen,
    week: {
      cookingDate: '2026-10-10',
      cutoffAt: '2026-10-09T21:00:00+11:00',
      status: 'published',
      pickupPoints: [],
      delivery: { available: false, note: { en: 'a', id: 'b' } },
    },
    items: [],
    ordering: { open: true },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(menu))),
  );
}

/** A page with a half-typed form, standing in for the new-order screen. */
function Draft() {
  const [value, setValue] = useState('');
  return <input aria-label="Draft" value={value} onChange={(e) => setValue(e.target.value)} />;
}

function renderLayout(Layout: () => React.JSX.Element = SellerLayout) {
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={['/seller']}>
        <Routes>
          <Route path="/seller" element={<Layout />}>
            <Route index element={<Draft />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

/** The regression: typing, then crossing the 600 px line, must not clear the form. */
function typeThenFlip(): void {
  const draft = screen.getByLabelText('Draft');
  fireEvent.change(draft, { target: { value: 'half-filled' } });
  expect(screen.getByLabelText('Draft')).toHaveValue('half-filled');
  setWide(true);
  expect(screen.getByLabelText('Draft')).toHaveValue('half-filled');
}

describe('SellerLayout', () => {
  it('keeps the page state when the screen crosses 1024 px (one stable shell)', () => {
    stubKitchen();
    renderLayout();
    expect(screen.queryByRole('navigation', { name: 'Seller (phone)' })).toBeInTheDocument();
    typeThenFlip();
    // The rail is there now, so the flip really changed the layout.
    expect(screen.getByRole('button', { name: 'Collapse menu' })).toBeInTheDocument();
  });

  it('puts the background image behind the wide banner, with the colour as its fallback', async () => {
    stubKitchen();
    wide = true;
    renderLayout();
    const banner = await screen.findByRole('img', { name: 'Onde Onde banner' });
    const strip = banner.parentElement?.parentElement?.parentElement?.parentElement as HTMLElement;
    expect(strip).toHaveStyle({ backgroundColor: 'rgb(131, 89, 55)' });
    expect(strip.style.backgroundImage || getComputedStyle(strip).backgroundImage).toContain(
      '/samples/banner-bg.jpg',
    );
    expect(getComputedStyle(strip).backgroundSize).toBe('cover');
    expect(banner).toHaveStyle({ objectFit: 'cover' });
  });

  it('shows only the colour when the seller has no background image', async () => {
    stubKitchen({
      ...KITCHEN,
      images: { ...KITCHEN.images, bannerBackgroundImage: undefined },
    });
    wide = true;
    renderLayout();
    const banner = await screen.findByRole('img', { name: 'Onde Onde banner' });
    const strip = banner.parentElement?.parentElement?.parentElement?.parentElement as HTMLElement;
    expect(strip).toHaveStyle({ backgroundColor: 'rgb(131, 89, 55)' });
    expect(getComputedStyle(strip).backgroundImage).not.toContain('url');
  });

  it('slides the sheet over the banner past 8 px of scrolling and back at the top (plan 040)', async () => {
    stubKitchen();
    wide = true;
    renderLayout();
    const banner = await screen.findByRole('img', { name: 'Onde Onde banner' });
    const full = banner.parentElement?.parentElement as HTMLElement;
    const clip = full.parentElement as HTMLElement;
    // Full size: as tall as the left menu's top (116 logo + 48 name), shorter if the width is narrow.
    expect(full).toHaveStyle({ maxHeight: '164px' });
    expect(clip).toHaveStyle({ maxHeight: '164px' });
    const content = screen.getByLabelText('Draft');
    const scrollTo = (top: number) => {
      content.scrollTop = top;
      fireEvent.scroll(content);
    };
    scrollTo(8);
    expect(clip).toHaveStyle({ maxHeight: '164px' });
    scrollTo(9);
    expect(clip).toHaveStyle({ maxHeight: '73px' });
    // The image keeps its size: only the strip around it shortens.
    expect(full).toHaveStyle({ maxHeight: '164px' });
    scrollTo(0);
    expect(clip).toHaveStyle({ maxHeight: '164px' });
  });

  it('keeps the banner full while the left menu is collapsed (unlinked)', async () => {
    localStorage.setItem('sellerRailCollapsed', '1');
    stubKitchen();
    wide = true;
    renderLayout();
    const banner = await screen.findByRole('img', { name: 'Onde Onde banner' });
    const full = banner.parentElement?.parentElement as HTMLElement;
    expect(full.parentElement).toHaveStyle({ maxHeight: '164px' });
    expect(full).toHaveStyle({ maxHeight: '164px' });
    localStorage.clear();
  });

  it('shows the paused-kitchen notice in the notice slot, in both languages (plan 032)', async () => {
    stubKitchen();
    const me: Me = {
      role: 'seller',
      stage: 'full',
      sellerId: 's1',
      slug: 'onde-onde',
      sellerName: 'Delave',
      paused: 'customers',
    };
    function Adopt() {
      const { adopt } = useSession();
      useEffect(() => {
        adopt(me);
      }, [adopt]);
      return null;
    }
    render(
      <AppThemeProvider>
        <SessionProvider>
          <Adopt />
          <MemoryRouter initialEntries={['/seller']}>
            <Routes>
              <Route path="/seller" element={<SellerLayout />}>
                <Route index element={<Draft />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </SessionProvider>
      </AppThemeProvider>,
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Customers can't see your kitchen right now.",
    );
    await act(() => i18n.changeLanguage('id'));
    expect(
      await screen.findByText('Pelanggan tidak bisa melihat dapur Anda saat ini.'),
    ).toBeVisible();
    await act(() => i18n.changeLanguage('en'));
  });

  it('shows no notice for an open kitchen', () => {
    stubKitchen();
    renderLayout();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('SellerLayout banner (plan 094)', () => {
  function Go() {
    const go = useNavigate();
    return (
      <>
        {['/seller', '/seller/menu', '/seller/orders', '/seller/orders/42'].map((to) => (
          <button key={to} onClick={() => void go(to)}>{`go ${to}`}</button>
        ))}
      </>
    );
  }
  function renderRoutes() {
    return render(
      <AppThemeProvider>
        <MemoryRouter initialEntries={['/seller']}>
          <Routes>
            <Route path="/seller" element={<SellerLayout />}>
              <Route index element={<Go />} />
              <Route path="*" element={<Go />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppThemeProvider>,
    );
  }
  const banner = () => screen.getByRole('img', { name: 'Onde Onde banner', hidden: true });
  const visit = (to: string) => fireEvent.click(screen.getByText(`go ${to}`));

  it('keeps the same tablet banner element from Home to a task screen and back', async () => {
    stubKitchen();
    wide = true;
    renderRoutes();
    await screen.findByRole('img', { name: 'Onde Onde banner' });
    const first = banner();
    visit('/seller/menu');
    expect(banner()).toBe(first);
    visit('/seller');
    expect(banner()).toBe(first);
  });

  it('keeps the same phone banner element from the Orders list to an order and back', async () => {
    stubKitchen();
    renderRoutes();
    await screen.findByRole('img', { name: 'Onde Onde banner' });
    const first = banner();
    visit('/seller/orders/42');
    expect(banner()).toBe(first);
    visit('/seller/orders');
    expect(banner()).toBe(first);
  });
});
