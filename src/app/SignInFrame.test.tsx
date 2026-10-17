import { render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { APP_NAME } from '../../shared/appName';
import { initI18n } from '../i18n/init';
import { brandPill } from '../theme/brandTokens';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { SignInFrame } from './SignInFrame';

const fetchMenu = vi.fn();
vi.mock('../api/client', () => ({ fetchMenu: (slug: string) => fetchMenu(slug) as unknown }));

let deviceIsDark = true;
beforeAll(async () => {
  window.matchMedia = () =>
    ({
      matches: deviceIsDark,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => {
  deviceIsDark = true;
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
  it('shows ShaggyBobo branding when no kitchen was used, and asks for nothing', () => {
    renderFrame();
    expect(fetchMenu).not.toHaveBeenCalled();
    expect(screen.getByText('Seller sign-in')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'ShaggyBobo' }).length).toBeGreaterThan(0);
    expect(screen.getByText(/© \d{4} ShaggyBobo/)).toBeInTheDocument();
    expect(screen.queryByText(APP_NAME)).toBeNull();
  });

  it('shows the branding when the remembered kitchen cannot be loaded', async () => {
    localStorage.setItem('lastKitchen', 'onde-onde');
    fetchMenu.mockResolvedValue({ ok: false });
    renderFrame();
    expect(await screen.findByText('Seller sign-in')).toBeInTheDocument();
  });

  it('keeps the kitchen name head, not the branding, when the device remembers a name', () => {
    render(
      <AppThemeProvider>
        <MemoryRouter>
          <SignInFrame kitchenName="Onde Onde">
            <main>form</main>
          </SignInFrame>
        </MemoryRouter>
      </AppThemeProvider>,
    );
    expect(screen.getByText('Onde Onde')).toBeInTheDocument();
    expect(screen.queryByText('Seller sign-in')).toBeNull();
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
    expect(await screen.findByText('Onde Onde')).toBeInTheDocument();
    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'ShaggyBobo' })).toBeNull();
  });

  it.each(['admin', 'sellerSetup'] as const)(
    'shows ShaggyBobo branding on %s and ignores the last kitchen (plan 036)',
    (page) => {
      localStorage.setItem('lastKitchen', 'onde-onde');
      renderFrame(page);
      expect(fetchMenu).not.toHaveBeenCalled();
      expect(screen.queryByText('Onde Onde')).toBeNull();
      if (page === 'sellerSetup') expect(screen.getByText('Seller setup')).toBeInTheDocument();
      else expect(screen.queryByText('Seller setup')).toBeNull();
      expect(screen.getAllByRole('img', { name: 'ShaggyBobo' }).length).toBeGreaterThan(0);
      expect(screen.getByText(/© \d{4} ShaggyBobo/)).toBeInTheDocument();
      expect(screen.getByText('v1.0.40')).toBeInTheDocument();
    },
  );

  it('puts the logo in the light pill in light mode and the dark pill in dark mode', () => {
    deviceIsDark = false;
    const light = renderFrame('admin');
    const lightPill = screen.getAllByRole('img', { name: 'ShaggyBobo' }).at(-1)!;
    expect(lightPill).toHaveStyle({ background: 'var(--brand-bg)' });
    expect(lightPill.getAttribute('class')).toBeTruthy();
    expect(getComputedStyle(lightPill).getPropertyValue('--brand-bg')).toBe(brandPill.light.bg);
    light.unmount();
    deviceIsDark = true;
    renderFrame('admin');
    const darkPill = screen.getAllByRole('img', { name: 'ShaggyBobo' }).at(-1)!;
    expect(getComputedStyle(darkPill).getPropertyValue('--brand-bg')).toBe(brandPill.dark.bg);
  });

  it('shows the happy-face icon, no leaf', () => {
    renderFrame('admin');
    const pill = screen.getAllByRole('img', { name: 'ShaggyBobo' }).at(-1)!;
    expect(pill.querySelector('img')).toHaveAttribute('src', '/brand/logo-icon.webp');
    expect(pill.querySelector('svg')).toBeNull();
  });

  it('on a phone has no brand top or bottom bar, only a small version line', () => {
    deviceIsDark = false; // the mock answers every media query alike: false = no split = phone
    renderFrame('admin');
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getAllByRole('img', { name: 'ShaggyBobo' })).toHaveLength(1);
    expect(screen.getByText('v1.0.40')).toBeInTheDocument();
    expect(screen.getByText(/© \d{4} ShaggyBobo/)).toBeInTheDocument();
  });
});
