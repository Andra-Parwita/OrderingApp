import { render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { APP_NAME } from '../../shared/appName';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { SignInFrame } from './SignInFrame';

const fetchMenu = vi.fn();
vi.mock('../api/client', () => ({ fetchMenu: (slug: string) => fetchMenu(slug) as unknown }));

beforeAll(async () => {
  window.matchMedia = () =>
    ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => {
  localStorage.clear();
  fetchMenu.mockReset();
});

function renderFrame(brand?: 'admin' | 'sellerSetup') {
  return render(
    <AppThemeProvider>
      <MemoryRouter>
        <SignInFrame brand={brand}>
          <main>form</main>
        </SignInFrame>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

const menuWith = (images: Record<string, string>) => ({
  ok: true,
  data: { kitchen: { sellerId: 's1', name: 'Onde Onde', tagline: {}, images } },
});

describe('SignInFrame (D-051)', () => {
  it('shows the app name on a plain panel when no kitchen was used, and asks for nothing', () => {
    renderFrame();
    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(fetchMenu).not.toHaveBeenCalled();
  });

  it("shows the last kitchen's phone banner whole, with its alt text", async () => {
    localStorage.setItem('lastKitchen', 'onde-onde');
    fetchMenu.mockResolvedValue(
      menuWith({ phoneBanner: '/phone.png', bannerBackground: '#8a5a3c' }),
    );
    renderFrame();
    const image = await screen.findByRole('img', { name: 'Onde Onde banner' });
    expect(image).toHaveAttribute('src', '/phone.png');
    expect(fetchMenu).toHaveBeenCalledWith('onde-onde');
    expect(screen.queryByText(APP_NAME)).toBeNull();
  });

  it('falls back to the plain panel when the kitchen has no phone banner', async () => {
    localStorage.setItem('lastKitchen', 'onde-onde');
    fetchMenu.mockResolvedValue(menuWith({ desktopBanner: '/wide.png' }));
    renderFrame();
    await waitFor(() => expect(fetchMenu).toHaveBeenCalled());
    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it.each(['admin', 'sellerSetup'] as const)(
    'shows ShaggyBobo branding on %s and ignores the last kitchen (plan 028)',
    (page) => {
      localStorage.setItem('lastKitchen', 'onde-onde');
      renderFrame(page);
      expect(fetchMenu).not.toHaveBeenCalled();
      expect(screen.queryByText('Onde Onde')).toBeNull();
      if (page === 'sellerSetup') expect(screen.getByText('Seller setup')).toBeInTheDocument();
      else expect(screen.queryByText('Seller setup')).toBeNull();
      expect(screen.getAllByRole('img', { name: 'ShaggyBobo' }).length).toBeGreaterThan(0);
      expect(screen.getByText(/© \d{4} ShaggyBobo/)).toBeInTheDocument();
      expect(screen.getByText('vdev')).toBeInTheDocument();
    },
  );
});
