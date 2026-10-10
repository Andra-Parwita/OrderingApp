import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { SellerLayout } from './SellerLayout';

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
    expect(banner).toHaveStyle({ objectFit: 'contain' });
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
});
