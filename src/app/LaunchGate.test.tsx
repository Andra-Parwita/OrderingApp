import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../../shared/authContract';
import * as auth from '../api/auth';
import { forgetDevTools } from '../api/devTools';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { SellerGuard } from './guards';
import { LaunchGate } from './LaunchGate';
import {
  forgetPageLoad,
  launchMemory,
  markReloaded,
  rememberLaunchKitchen,
  reloadedFor,
} from './launchKitchen';
import { SessionProvider, useSession } from './session';

// Plan 101 stages 3 and 4: a kitchen's own seller app opens that kitchen.

vi.mock('../api/auth', async (original) => ({
  ...(await original<typeof import('../api/auth')>()),
  fetchMemberships: vi.fn(),
  switchKitchen: vi.fn(),
  fetchMe: vi.fn(),
}));
vi.mock('../api/client', async (original) => ({
  ...(await original<typeof import('../api/client')>()),
  fetchMenu: vi.fn(() => Promise.resolve({ ok: true, data: { kitchen: { name: 'Onde Onde' } } })),
}));

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
beforeEach(() => {
  forgetPageLoad();
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  forgetDevTools();
  vi.clearAllMocks();
});

const DELLAVEE: Me = {
  role: 'seller',
  stage: 'full',
  sellerId: 's1',
  slug: 'dellavee',
  sellerName: 'Dellavee',
};
const ONDE: Me = { ...DELLAVEE, sellerId: 's2', slug: 'onde-onde', sellerName: 'Onde Onde' };
const memberships = (...list: Array<Me>) =>
  vi.mocked(auth.fetchMemberships).mockResolvedValue({
    ok: true,
    data: {
      memberships: list.map((m) => ({
        sellerId: m.sellerId ?? '',
        slug: m.slug ?? '',
        sellerName: m.sellerName ?? '',
        role: 'owner' as const,
      })),
    },
  });
const switchOk = (me: Me) =>
  vi.mocked(auth.switchKitchen).mockResolvedValue({ ok: true, data: { me } });

function renderGate(me: Me, reload = vi.fn(), target = 'onde-onde') {
  render(
    <AppThemeProvider>
      <SessionProvider>
        <LaunchGate me={me} target={target} reload={reload}>
          <p>the orders</p>
        </LaunchGate>
      </SessionProvider>
    </AppThemeProvider>,
  );
  return reload;
}

describe('opening a kitchen from its own seller app', () => {
  it('same kitchen: nothing happens', () => {
    const reload = renderGate(ONDE);
    expect(screen.getByText('the orders')).toBeInTheDocument();
    expect(auth.switchKitchen).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('a member of the other kitchen: switches, shows Opening, reloads once', async () => {
    memberships(DELLAVEE, ONDE);
    switchOk(ONDE);
    const reload = renderGate(DELLAVEE);
    expect(await screen.findByText('Opening Onde Onde…')).toBeInTheDocument();
    expect(auth.switchKitchen).toHaveBeenCalledWith('s2');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith('onde-onde');
    expect(screen.queryByText('the orders')).toBeNull();
    expect(reloadedFor()).toBe('onde-onde');
  });

  it('removed from the team: says so and offers the other kitchen', async () => {
    memberships(DELLAVEE);
    const reload = renderGate(DELLAVEE);
    expect(
      await screen.findByRole('heading', { name: "You are not on Onde Onde's team any more" }),
    ).toBeInTheDocument();
    expect(auth.switchKitchen).not.toHaveBeenCalled();
    expect(screen.queryByText('the orders')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Dellavee' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(launchMemory()).toBe('dellavee'); // the reload must not come back here
  });

  it('paused kitchen: says so and offers the other kitchen', async () => {
    memberships(DELLAVEE, ONDE);
    vi.mocked(auth.switchKitchen).mockResolvedValue({
      ok: false,
      error: 'forbidden',
      status: 403,
      message: 'no',
    });
    renderGate(DELLAVEE);
    expect(await screen.findByRole('heading', { name: 'Onde Onde is paused' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Dellavee' })).toBeInTheDocument();
  });

  it('any other failure falls back to today: the app opens', async () => {
    vi.mocked(auth.fetchMemberships).mockResolvedValue({
      ok: false,
      error: 'network',
      status: 0,
      message: 'offline',
    });
    renderGate(DELLAVEE);
    expect(await screen.findByText('the orders')).toBeInTheDocument();
  });

  it('loop guard: a second launch for the same kitchen does not reload', async () => {
    memberships(DELLAVEE, ONDE);
    switchOk(ONDE);
    const first = renderGate(DELLAVEE);
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    // The reload came back still on Dellavee (the server did not keep the switch).
    document.body.innerHTML = '';
    vi.mocked(auth.switchKitchen).mockClear();
    const second = renderGate(DELLAVEE);
    expect(await screen.findByText('the orders')).toBeInTheDocument();
    expect(second).not.toHaveBeenCalled();
    expect(auth.switchKitchen).not.toHaveBeenCalled();
  });

  it('arriving on the right kitchen clears the guard, so a later mismatch may reload once', () => {
    markReloaded('onde-onde');
    renderGate(ONDE);
    expect(reloadedFor()).toBeNull();
  });
});

describe('resume check (two seller apps share one cookie)', () => {
  const resume = async () => {
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
  };

  it('another app switched the kitchen: switch back and reload once', async () => {
    vi.mocked(auth.fetchMe).mockResolvedValue({ ok: true, data: { me: DELLAVEE } });
    memberships(DELLAVEE, ONDE);
    switchOk(ONDE);
    const reload = renderGate(ONDE);
    await resume();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(auth.switchKitchen).toHaveBeenCalledWith('s2');
  });

  it('same kitchen on the server: nothing happens', async () => {
    vi.mocked(auth.fetchMe).mockResolvedValue({ ok: true, data: { me: ONDE } });
    const reload = renderGate(ONDE);
    await resume();
    expect(auth.fetchMe).toHaveBeenCalled();
    expect(auth.switchKitchen).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload again for a kitchen it just reloaded for', async () => {
    vi.mocked(auth.fetchMe).mockResolvedValue({ ok: true, data: { me: DELLAVEE } });
    memberships(DELLAVEE, ONDE);
    switchOk(ONDE);
    const reload = renderGate(ONDE);
    markReloaded('onde-onde'); // set after arrival: a reload was made and the mismatch is back
    await resume();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('the seller guard with a launch kitchen', () => {
  function Where() {
    const { pathname, search } = useLocation();
    return <p>{`at ${pathname}${search}`}</p>;
  }
  function Adopter({ me }: Readonly<{ me: Me }>) {
    const { adopt } = useSession();
    return <button onClick={() => adopt(me)}>adopt</button>;
  }
  const renderGuard = (path: string, me: Me | null, adopting?: Me) => {
    localStorage.setItem('signedIn', '1');
    vi.mocked(auth.fetchMe).mockResolvedValue(
      me
        ? { ok: true, data: { me } }
        : { ok: false, error: 'unauthorized', status: 401, message: '' },
    );
    return render(
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <SessionProvider>
            <Routes>
              <Route path="/seller/sign-in" element={<Where />} />
              <Route path="/seller/setup" element={<Where />} />
              <Route
                path="/seller/orders"
                element={
                  <SellerGuard>
                    <p>the orders</p>
                    {adopting ? <Adopter me={adopting} /> : null}
                  </SellerGuard>
                }
              />
            </Routes>
          </SessionProvider>
        </MemoryRouter>
      </AppThemeProvider>,
    );
  };

  it('signed out with k: sign-in keeps k and names the kitchen', async () => {
    renderGuard('/seller/orders?k=onde-onde', null);
    expect(
      await screen.findByText('at /seller/sign-in?kitchen=onde-onde&k=onde-onde'),
    ).toBeInTheDocument();
    expect(launchMemory()).toBe('onde-onde'); // so the same rules run after sign-in
  });

  it('signed out without k: today (setup when no one signed in here before)', async () => {
    renderGuard('/seller/orders', null);
    expect(await screen.findByText('at /seller/setup')).toBeInTheDocument();
    expect(launchMemory()).toBeNull();
  });

  it('signed in without k and nothing remembered: today, no switching', async () => {
    renderGuard('/seller/orders', DELLAVEE);
    expect(await screen.findByText('the orders')).toBeInTheDocument();
    expect(auth.fetchMemberships).not.toHaveBeenCalled();
  });

  it('no k in the address but remembered: the remembered kitchen is used', async () => {
    rememberLaunchKitchen('onde-onde');
    memberships(DELLAVEE, ONDE);
    switchOk(ONDE);
    renderGuard('/seller/orders', DELLAVEE);
    await waitFor(() => expect(auth.switchKitchen).toHaveBeenCalledWith('s2'));
  });

  it('a deliberate switch inside the app moves the remembered kitchen', async () => {
    rememberLaunchKitchen('dellavee');
    renderGuard('/seller/orders', DELLAVEE, ONDE);
    expect(await screen.findByText('the orders')).toBeInTheDocument();
    fireEvent.click(screen.getByText('adopt'));
    expect(launchMemory()).toBe('onde-onde');
  });
});
