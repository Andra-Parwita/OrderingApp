import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import i18n from 'i18next';
import { forgetDevTools } from '../api/devTools';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { SellerGuard, SellerOnly } from './guards';
import { SessionProvider } from './session';

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

afterEach(() => {
  forgetDevTools();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function stubMe(me: Record<string, unknown> | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        me
          ? Response.json({ me })
          : Response.json({ error: 'unauthorized', message: 'Sign in' }, { status: 401 }),
      ),
    ),
  );
}

function renderSeller() {
  localStorage.setItem('signedIn', '1'); // the hint a sign-in leaves; the session itself is a cookie
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={['/seller/menu']}>
        <SessionProvider>
          <Routes>
            <Route path="/seller/setup" element={<p>setup page</p>} />
            <Route path="/seller/sign-in" element={<p>sign-in page</p>} />
            <Route
              path="/seller/menu"
              element={
                <SellerGuard>
                  <SellerOnly>
                    <p>the menu editor</p>
                  </SellerOnly>
                </SellerGuard>
              }
            />
          </Routes>
        </SessionProvider>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

const SELLER = { role: 'seller', stage: 'full', slug: 'dapur-demo', sellerName: 'Dapur Demo' };

describe('route guards', () => {
  it('lets a signed-in seller in', async () => {
    stubMe(SELLER);
    renderSeller();
    expect(await screen.findByText('the menu editor')).toBeInTheDocument();
  });

  it('tells a chef the page is not for chefs', async () => {
    stubMe({ ...SELLER, role: 'chef', chefId: 'c1', chefName: 'Rudi' });
    renderSeller();
    expect(await screen.findByRole('heading', { name: 'Not available for chefs' })).toBeVisible();
  });

  it('sends a rejected token to setup when the server has no dev tools (production)', async () => {
    forgetDevTools(); // the stubbed server below answers /api/health with a 401: dev tools are off
    stubMe(null);
    renderSeller();
    expect(await screen.findByText('setup page')).toBeInTheDocument();
  });

  it('sends a setup-stage session away (it may only finish registering)', async () => {
    stubMe({ ...SELLER, stage: 'setup' });
    renderSeller();
    expect(await screen.findByText('setup page')).toBeInTheDocument();
  });
});
