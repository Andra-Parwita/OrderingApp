import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { HomePage, KitchenNotFoundPage } from './pages';

beforeAll(async () => {
  await initI18n();
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
});
afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
});

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function renderHome(redirect = true) {
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={['/other', '/']} initialIndex={1}>
        <Routes>
          <Route path="/" element={<HomePage redirect={redirect} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

function renderDefault() {
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

describe('HomePage', () => {
  it('shows the logo and welcome when the phone knows no kitchen', () => {
    const { container } = renderHome();
    expect(container.textContent).toBe(
      'ShaggyBobo' +
        'Welcome to ShaggyBobo' +
        'Looking for something here? Open the link from the person or group who invited you.',
    );
    expect(screen.getByRole('img', { name: 'ShaggyBobo' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Welcome to ShaggyBobo' })).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('goes to the last kitchen, replacing the history entry', () => {
    localStorage.setItem('lastKitchen', 'onde-onde');
    renderHome();
    expect(screen.getByTestId('where').textContent).toBe('/onde-onde');
  });

  it('falls back to the newest saved order kitchen', () => {
    localStorage.setItem(
      'myOrders',
      JSON.stringify([
        { code: 'A', token: 't1', placedAt: '2026-10-01T00:00:00Z', sellerSlug: 'old-one' },
        { code: 'B', token: 't2', placedAt: '2026-10-10T00:00:00Z', sellerSlug: 'new-one' },
      ]),
    );
    renderHome();
    expect(screen.getByTestId('where').textContent).toBe('/new-one');
  });

  it('shows the logo for an invalid stored slug', () => {
    localStorage.setItem('lastKitchen', '../evil path');
    renderHome();
    expect(screen.getByRole('img', { name: 'ShaggyBobo' })).toBeVisible();
  });

  it('shows both lines in Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderHome();
    expect(screen.getByRole('heading', { name: 'Selamat datang di ShaggyBobo' })).toBeVisible();
    expect(
      screen.getByText(
        'Mencari sesuatu di sini? Buka tautan dari orang atau grup yang mengundangmu.',
      ),
    ).toBeVisible();
  });

  it('jumps to the known kitchen inside an installed app, and not in a browser tab', () => {
    const media = (standalone: boolean) => {
      window.matchMedia = ((query: string) => ({
        matches: standalone && query.includes('standalone'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })) as unknown as typeof window.matchMedia;
    };
    localStorage.setItem('lastKitchen', 'onde-onde');
    media(true);
    const app = renderDefault();
    expect(screen.getByTestId('where').textContent).toBe('/onde-onde');
    app.unmount();
    media(false);
    renderDefault();
    expect(screen.getByRole('heading', { name: 'Welcome to ShaggyBobo' })).toBeVisible();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('reserves the hero box at once, with the hero shape', () => {
    renderHome(false);
    expect(screen.getByTestId('home-hero-placeholder')).toBeInTheDocument();
    expect(getComputedStyle(screen.getByTestId('home-hero-box')).aspectRatio).toMatch(
      /^390 ?[/] ?104$/,
    );
  });

  it('shows the welcome page to a known phone when the redirect is off', () => {
    localStorage.setItem('lastKitchen', 'onde-onde');
    renderHome(false);
    expect(screen.getByRole('heading', { name: 'Welcome to ShaggyBobo' })).toBeVisible();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('does not bounce back to a kitchen that was not found', () => {
    localStorage.setItem('lastKitchen', 'gone-kitchen');
    localStorage.setItem(
      'myOrders',
      JSON.stringify([
        { code: 'A', token: 't1', placedAt: '2026-10-01T00:00:00Z', sellerSlug: 'gone-kitchen' },
      ]),
    );
    const first = render(
      <AppThemeProvider>
        <MemoryRouter initialEntries={['/gone-kitchen']}>
          <Routes>
            <Route path="/:slug" element={<KitchenNotFoundPage />} />
          </Routes>
        </MemoryRouter>
      </AppThemeProvider>,
    );
    first.unmount();
    expect(localStorage.getItem('lastKitchen')).toBeNull();
    renderHome();
    expect(screen.getByRole('heading', { name: 'Welcome to ShaggyBobo' })).toBeVisible();
    sessionStorage.clear();
  });
});
