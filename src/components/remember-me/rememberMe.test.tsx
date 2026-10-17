import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  signOutHere: vi.fn(() => Promise.resolve()),
  deleteMySavedData: vi.fn(() => Promise.resolve({ ok: true as const, signalled: false })),
  kitchenCode: vi.fn(() => Promise.resolve('C-7K3M')),
  turnOnRememberMe: vi.fn(() => Promise.resolve({ ok: true as const, sealing: true, restored: 0 })),
  restoreWithPasskey: vi.fn(() =>
    Promise.resolve({ ok: true as const, sealing: true, restored: 3 }),
  ),
  showPhoneCode: vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      data: { code: '123456', expiresAt: new Date(Date.now() + 300_000).toISOString() },
    }),
  ),
}));
vi.mock('../../api/customer/rememberMe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/customer/rememberMe')>()),
  ...api,
  rememberMeSupported: () => true,
}));

import en from '../../i18n/en.json';
import id from '../../i18n/id.json';
import { setRememberMeLocal } from '../../api/customer/state';
import { lightTheme } from '../../theme/themes';
import { PrivacyModal, RememberMeCard, RememberMeChip, RememberMeNudge, RestoreOrders } from '.';
import { registerRememberMeI18n } from './i18n/register';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, id: { translation: id } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  registerRememberMeI18n();
});
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

const wrap = (node: React.ReactNode) => <ThemeProvider theme={lightTheme}>{node}</ThemeProvider>;
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

describe('the chip', () => {
  it('shows the first time, opens the explanation, and the cross hides it for good', () => {
    const first = render(wrap(<RememberMeChip />));
    fireEvent.click(screen.getByRole('button', { name: 'Remember me on all my phones' }));
    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveTextContent("What's a passkey?");
    expect(sheet).toHaveTextContent("Why it's safe");
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeVisible();
    expect(screen.getByRole('button', { name: /I already use Remember me/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hide this' }));
    expect(screen.queryByRole('button', { name: 'Remember me on all my phones' })).toBeNull();
    first.unmount();
    render(wrap(<RememberMeChip />));
    expect(screen.queryByRole('button', { name: 'Remember me on all my phones' })).toBeNull();
  });

  it('is not shown when Remember me is already on', () => {
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    render(wrap(<RememberMeChip />));
    expect(screen.queryByRole('button', { name: 'Remember me on all my phones' })).toBeNull();
  });

  it('Turn on runs the flow and closes the sheet', async () => {
    render(wrap(<RememberMeChip />));
    fireEvent.click(screen.getByRole('button', { name: 'Remember me on all my phones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(api.turnOnRememberMe).toHaveBeenCalledTimes(1);
  });
});

describe('the Settings card', () => {
  it('off: explains and offers Turn on and "I already use Remember me"', () => {
    render(wrap(<RememberMeCard kitchenName="Onde Onde" />));
    expect(screen.getByText(/Your orders, name and saved address follow you/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(api.turnOnRememberMe).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /I already use Remember me/ })).toBeVisible();
  });

  it('on: this phone, the kitchen code, sign out and delete both ask first', async () => {
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    render(wrap(<RememberMeCard kitchenName="Onde Onde" />));
    expect(await screen.findByText('C-7K3M')).toBeVisible();
    expect(screen.getByText('Your customer code at Onde Onde')).toBeVisible();
    expect(screen.getByText('This phone')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out on this phone' }));
    expect(api.signOutHere).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.signOutHere).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete my saved data' }));
    expect(api.deleteMySavedData).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(api.deleteMySavedData).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out on this phone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(api.signOutHere).toHaveBeenCalledTimes(1);
  });

  it('on without sealing says the address stays on this phone', () => {
    setRememberMeLocal({ credentialId: 'c', sealing: false, setup: false });
    render(wrap(<RememberMeCard />));
    expect(screen.getByText(/can't seal your address/)).toBeVisible();
  });

  it('Add another phone shows a 6 digit code with a countdown', async () => {
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    render(wrap(<RememberMeCard />));
    fireEvent.click(screen.getByRole('button', { name: 'Add another phone' }));
    expect(await screen.findByText('123456')).toBeVisible();
    expect(screen.getByRole('timer')).toHaveTextContent(/Valid for [45]:\d\d/);
  });

  it('shows in Indonesian', async () => {
    await act(() => i18n.changeLanguage('id'));
    render(wrap(<RememberMeCard />));
    expect(screen.getByRole('button', { name: 'Nyalakan' })).toBeVisible();
    await act(() => i18n.changeLanguage('en'));
  });
});

describe('the other offers', () => {
  it('shows one line after the 2nd order, and the cross dismisses it', () => {
    orders(1);
    const one = render(wrap(<RememberMeNudge />));
    expect(screen.queryByText('Remember me on all your phones?')).toBeNull();
    one.unmount();
    orders(2);
    render(wrap(<RememberMeNudge />));
    expect(screen.getByText(/Remember me on all your phones\?/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Hide this' }));
    expect(screen.queryByText(/Remember me on all your phones\?/)).toBeNull();
  });

  it('empty My orders offers Restore and confirms how many came back', async () => {
    render(wrap(<RestoreOrders />));
    expect(screen.getByText('Had orders on another phone or app?')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Restore them' }));
    expect(await screen.findByText(/3 orders restored/)).toBeVisible();
  });
});

describe('the privacy modal', () => {
  it('explains today and Remember me, and closes', () => {
    const onClose = vi.fn();
    render(wrap(<PrivacyModal onClose={onClose} />));
    expect(screen.getByRole('dialog', { name: 'How we keep your data private' })).toBeVisible();
    expect(screen.getByText(/sealed with your passkey/)).toBeVisible();
    expect(screen.getByText(/12 months/)).toBeVisible();
    expect(screen.getByText(/Settings > Passwords/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
