import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RELEASE_VERSION } from '../../shared/release';
import { WHATS_NEW_KEY_PREFIX } from '../components/whats-new/WhatsNewPill';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { SellerLayout } from './SellerLayout';
import { SignInFrame } from './SignInFrame';

// Plan 123: a tall (2:1) phone banner on the seller's phone Orders list and on the sign-in page shows only its
// bottom 3:1, exactly like a 1200 x 400 one. The shape is read from the loaded picture.

const fetchMenu = vi.fn();
vi.mock('../api/client', () => ({ fetchMenu: (slug: string) => fetchMenu(slug) as unknown }));

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  await i18n.changeLanguage('en');
});
beforeEach(() => localStorage.setItem(WHATS_NEW_KEY_PREFIX + RELEASE_VERSION, '1'));
afterEach(() => {
  localStorage.clear();
  fetchMenu.mockReset();
});

const pageCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent)
    .join('')
    .replace(/\s+/g, '');

function loaded(picture: HTMLElement, width: number, height: number) {
  Object.defineProperty(picture, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(picture, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(picture);
}

const menuWith = (images: Record<string, string>) => ({
  ok: true,
  data: {
    kitchen: { sellerId: 's1', name: 'Onde Onde', tagline: {}, images },
  },
});

describe('seller phone Orders banner (plan 123)', () => {
  const renderLayout = () =>
    render(
      <AppThemeProvider>
        <MemoryRouter initialEntries={['/seller']}>
          <Routes>
            <Route path="/seller" element={<SellerLayout />}>
              <Route index element={<p>orders</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppThemeProvider>,
    );

  it('shows only the bottom 3:1 of a tall banner', async () => {
    fetchMenu.mockResolvedValue(menuWith({ phoneBanner: '/phone.jpg' }));
    renderLayout();
    const picture = await screen.findByRole('img', { name: /Onde Onde/ });
    expect(picture.parentElement?.getAttribute('data-ratio')).toBe('3 / 1');
    loaded(picture, 1200, 600);
    await waitFor(() => expect(picture).toHaveStyle({ objectFit: 'cover' }));
    expect(picture).toHaveStyle({ objectPosition: 'center bottom' });
  });

  it('shows a 3:1 banner whole, as before', async () => {
    fetchMenu.mockResolvedValue(menuWith({ phoneBanner: '/phone.jpg' }));
    renderLayout();
    const picture = await screen.findByRole('img', { name: /Onde Onde/ });
    loaded(picture, 1200, 400);
    expect(picture).toHaveStyle({ objectFit: 'contain' });
  });
});

describe('seller sign-in banner (plan 123)', () => {
  const renderFrame = () =>
    render(
      <AppThemeProvider>
        <MemoryRouter>
          <SignInFrame>
            <main>form</main>
          </SignInFrame>
        </MemoryRouter>
      </AppThemeProvider>,
    );

  it('shows only the bottom 3:1 of a tall banner, as large as the panel allows', async () => {
    localStorage.setItem('lastKitchen', 'onde-onde');
    fetchMenu.mockResolvedValue(menuWith({ phoneBanner: '/phone.png' }));
    renderFrame();
    const picture = await screen.findByRole('img', { name: 'Onde Onde banner' });
    expect(getComputedStyle(picture).opacity).toBe('0'); // invisible until its shape is known
    loaded(picture, 1200, 600);
    await waitFor(() => expect(picture).toHaveStyle({ objectFit: 'cover' }));
    expect(picture).toHaveStyle({ objectPosition: 'center bottom' });
    expect(getComputedStyle(picture).opacity).not.toBe('0');
    expect(pageCss()).toContain('width:min(100cqw,300cqh);aspect-ratio:3/1');
  });

  it('shows a 3:1 banner whole, as before', async () => {
    localStorage.setItem('lastKitchen', 'onde-onde');
    fetchMenu.mockResolvedValue(menuWith({ phoneBanner: '/phone.png' }));
    renderFrame();
    const picture = await screen.findByRole('img', { name: 'Onde Onde banner' });
    loaded(picture, 1200, 400);
    expect(picture).toHaveStyle({ objectFit: 'contain' });
    expect(picture.getAttribute('style') ?? '').not.toContain('bottom');
  });
});
