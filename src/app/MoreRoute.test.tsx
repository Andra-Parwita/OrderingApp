import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Me } from '../../shared/authContract';
import { versionLabel } from '../../shared/release';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { MoreRoute } from './MoreRoute';

// Plan 125: the phone More screen has no Switch person; Sign out asks twice; the version shows.

let me: Me | null = null;
const end = vi.fn(() => Promise.resolve());
vi.mock('./session', () => ({ useSession: () => ({ me, end }) }));

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
afterEach(async () => {
  me = null;
  end.mockClear();
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
});

function renderMore() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json({}))),
  );
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={['/seller/more']}>
        <Routes>
          <Route path="/seller/more" element={<MoreRoute />} />
          <Route path="/seller/sign-in" element={<p>Sign-in page</p>} />
        </Routes>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

describe('MoreRoute on a phone', () => {
  it('shows who is signed in but has no Switch person, even in a kitchen with several people', () => {
    me = { role: 'seller', stage: 'full', sellerName: 'Delave', people: 3 };
    renderMore();
    expect(screen.getByText('Signed in as')).toBeInTheDocument();
    expect(screen.getByText('Delave · seller')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Switch person/ })).not.toBeInTheDocument();
  });

  it('signs out on the second tap, and says what signing in again needs', async () => {
    me = { role: 'seller', stage: 'full', sellerName: 'Delave', people: 1 };
    renderMore();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(end).not.toHaveBeenCalled();
    expect(
      screen.getByText('You will need your screen lock or password to sign in again.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to sign out' }));
    expect(await screen.findByText('Sign-in page')).toBeInTheDocument();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('shows the version line in both languages', async () => {
    me = { role: 'chef', stage: 'full', sellerName: 'Delave', chefName: 'Rina' };
    renderMore();
    expect(screen.getByText(`Version ${versionLabel()}`)).toBeInTheDocument();
    await i18n.changeLanguage('id');
    expect(await screen.findByText(`Versi ${versionLabel()}`)).toBeInTheDocument();
  });
});
