import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  turnOnRememberMe: vi.fn(() => Promise.resolve({ ok: true as const, sealing: true, restored: 0 })),
}));
vi.mock('../../api/customer/rememberMe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/customer/rememberMe')>()),
  ...api,
  rememberMeSupported: () => true,
}));

import en from '../../i18n/en.json';
import id from '../../i18n/id.json';
import { registerInstallI18n } from '../../components/install';
import { detectEnvironment } from '../../components/install/detect';
import { registerRememberMeI18n, setWantsRememberMe } from '../../components/remember-me';
import { setRememberMeLocal } from '../../api/customer/state';
import { setTopBarHeight } from '../../theme/topBars';
import { lightTheme } from '../../theme/themes';
import { PlacedNudge } from './PlacedNudge';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const browser = { env: detectEnvironment({ userAgent: IPHONE }) };
const installed = { env: detectEnvironment({ userAgent: IPHONE, navigatorStandalone: true }) };
const desktop = {
  env: detectEnvironment({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
    platform: 'Win32',
  }),
};

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, id: { translation: id } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  registerInstallI18n();
  registerRememberMeI18n();
});
afterEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
beforeEach(() => {
  localStorage.clear();
  setWantsRememberMe(false);
  vi.clearAllMocks();
});

const orders = (n: number) =>
  localStorage.setItem(
    'myOrders',
    JSON.stringify(
      Array.from({ length: n }, (_, i) => ({
        code: `A-${String(i)}`,
        token: `tok${String(i)}`.padEnd(20, 'x'),
        placedAt: '2026-10-10T00:00:00Z',
      })),
    ),
  );
const show = (props: { delivery?: boolean; install?: typeof browser } = {}) =>
  render(
    <ThemeProvider theme={lightTheme}>
      <PlacedNudge
        delivery={props.delivery ?? false}
        kitchenName="Onde Onde"
        install={props.install ?? browser}
      />
    </ThemeProvider>,
  );
const DAY = 24 * 60 * 60 * 1000;

describe('the home-screen pill', () => {
  it('shows on a first order in the browser, in both languages, and How opens the steps', async () => {
    orders(1);
    const first = show();
    expect(screen.getByText('Add to your home screen')).toBeVisible();
    expect(screen.queryByTestId('remember-me-pill')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add to your home screen/ }));
    expect(screen.getByRole('dialog')).toBeVisible();
    first.unmount();
    await act(() => i18n.changeLanguage('id'));
    show();
    expect(screen.getByText('Tambahkan ke layar utama')).toBeVisible();
    expect(screen.getByText('Pasang aplikasi')).toBeVisible();
  });

  it('does not show inside the installed app, nor on a desktop browser that cannot install', () => {
    orders(1);
    const one = show({ install: installed });
    expect(screen.queryByTestId('home-screen-pill')).toBeNull();
    one.unmount();
    show({ install: desktop });
    expect(screen.queryByTestId('home-screen-pill')).toBeNull();
  });

  it('does not show on a later order', () => {
    orders(2);
    show();
    expect(screen.queryByTestId('home-screen-pill')).toBeNull();
  });

  it('the cross hides it for 14 days', () => {
    orders(1);
    const one = show();
    fireEvent.click(screen.getByRole('button', { name: 'Hide this for now' }));
    expect(screen.queryByTestId('home-screen-pill')).toBeNull();
    // Same page view: the Remember me pill does not take its place.
    expect(screen.queryByTestId('remember-me-pill')).toBeNull();
    one.unmount();
    show();
    expect(screen.queryByTestId('home-screen-pill')).toBeNull();
    const until = Number(localStorage.getItem('nudge:homeScreenUntil'));
    expect(until).toBeGreaterThan(Date.now() + 13 * DAY);
    expect(until).toBeLessThan(Date.now() + 15 * DAY);
  });
});

describe('the Remember me pill', () => {
  it('first order: "Keep this order", and the link opens the turn-on sheet', () => {
    orders(1);
    show({ install: installed });
    expect(screen.getByText('Keep this order')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Remember me' }));
    expect(screen.getByRole('dialog', { name: 'Turn on Remember me' })).toBeVisible();
  });

  it('a delivery order says "Keep your address", also on a later order; ID wording', async () => {
    orders(3);
    const one = show({ delivery: true, install: installed });
    expect(screen.getByText('Keep your address')).toBeVisible();
    one.unmount();
    await act(() => i18n.changeLanguage('id'));
    show({ delivery: true, install: installed });
    expect(screen.getByText('Simpan alamatmu')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ingat aku' })).toBeVisible();
  });

  it('a later pickup order has no pill', () => {
    orders(3);
    show({ install: installed });
    expect(screen.queryByTestId('remember-me-pill')).toBeNull();
  });

  it('the cross asks again after 30 days; 3 shows in total, then never', () => {
    orders(1);
    const one = show({ install: installed });
    fireEvent.click(screen.getByRole('button', { name: 'Hide this' }));
    one.unmount();
    show({ install: installed });
    expect(screen.queryByTestId('remember-me-pill')).toBeNull();
    const state = JSON.parse(localStorage.getItem('nudge:rememberMe') ?? '{}') as {
      until: number;
      shows: number;
    };
    expect(state.shows).toBe(1);
    expect(state.until).toBeGreaterThan(Date.now() + 29 * DAY);
    // 30 days later: shown again (2nd), then a 3rd time, then never.
    localStorage.setItem('nudge:rememberMe', JSON.stringify({ until: 0, shows: 1 }));
    for (const expected of [true, true, false]) {
      const view = show({ install: installed });
      expect(screen.queryByTestId('remember-me-pill') !== null).toBe(expected);
      view.unmount();
    }
  });

  it('is not shown when Remember me is on', () => {
    orders(1);
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    show({ install: installed });
    expect(screen.queryByTestId('remember-me-pill')).toBeNull();
  });
});

describe('one nudge at a time', () => {
  it('shows nothing while an update, maintenance or announcement bar is up', () => {
    orders(1);
    setTopBarHeight('update', 52);
    try {
      show();
      expect(screen.queryByTestId('home-screen-pill')).toBeNull();
      expect(screen.queryByTestId('remember-me-pill')).toBeNull();
    } finally {
      setTopBarHeight('update', 0);
    }
  });

  it('home-screen pill first: only one pill on a page view', () => {
    orders(1);
    show();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});

describe('the ticked box on the name step', () => {
  it('starts the turn-on after the order is placed, without the pill; closing leaves the page as it is', () => {
    orders(1);
    setWantsRememberMe(true);
    show({ install: installed });
    expect(screen.getByRole('dialog', { name: 'Turn on Remember me' })).toBeVisible();
    expect(screen.queryByTestId('remember-me-pill')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.turnOnRememberMe).not.toHaveBeenCalled();
  });

  it('the wish is used once', () => {
    orders(1);
    setWantsRememberMe(true);
    const one = show({ install: installed });
    one.unmount();
    show({ install: installed });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('plan 121: Order placed gets no new nudge line', () => {
  it('the My orders cards never show here, and no "Get a message" line is added', () => {
    orders(2);
    show({ install: desktop });
    expect(screen.queryByTestId('orders-nudge-notify')).toBeNull();
    expect(screen.queryByTestId('orders-nudge-remember')).toBeNull();
    expect(screen.queryByText(/Get a message/)).toBeNull();
  });
});
