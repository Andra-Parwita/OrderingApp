import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
afterEach(async () => {
  await act(() => i18n.changeLanguage('en'));
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

  it('Turn on asks for the first name first, then runs the flow and closes the sheet', async () => {
    render(wrap(<RememberMeChip />));
    fireEvent.click(screen.getByRole('button', { name: 'Remember me on all my phones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(api.turnOnRememberMe).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Turn on Remember me' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(api.turnOnRememberMe).toHaveBeenCalledTimes(1);
  });
});

describe('the turn-on sheet (plan 092)', () => {
  const open = () => {
    render(wrap(<RememberMeCard kitchenName="Onde Onde" />));
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
  };

  it('says why the address is kept and where to save the passkey', () => {
    open();
    expect(
      screen.getByText("We keep your address so it's filled in for you next time."),
    ).toBeVisible();
    expect(
      screen.getByText(/choose Passwords \(iPhone\) or Google Password Manager/),
    ).toBeVisible();
  });

  it('names the passkey after the typed first name and saves the name', async () => {
    open();
    expect(screen.getByText("Remember me · ShaggyBobo's Order")).toBeVisible();
    fireEvent.change(screen.getByLabelText('Your first name'), { target: { value: 'Indra' } });
    expect(screen.getByText('Indra · customer (Remember me)')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(api.turnOnRememberMe).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.getItem('firstName')).toBe('Indra');
  });

  it('Skip turns it on with the generic name and saves no name', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => {
      expect(api.turnOnRememberMe).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.getItem('firstName')).toBeNull();
  });

  it('prefills a known name and has no Skip', () => {
    localStorage.setItem('firstName', 'Indra');
    open();
    expect(screen.getByLabelText('Your first name')).toHaveValue('Indra');
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('shows in Indonesian', async () => {
    await act(() => i18n.changeLanguage('id'));
    render(wrap(<RememberMeCard kitchenName="Onde Onde" />));
    fireEvent.click(screen.getByRole('button', { name: 'Nyalakan' }));
    expect(screen.getByRole('dialog', { name: 'Nyalakan Ingat aku' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lewati' })).toBeVisible();
    await act(() => i18n.changeLanguage('en'));
  });
});

describe('the Settings card', () => {
  it('off: one Turn on, then quiet links with a hint', () => {
    render(wrap(<RememberMeCard kitchenName="Onde Onde" />));
    expect(
      screen.getByText(
        /We remember your orders, name and address on this phone and on any other phone/,
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'I already use Remember me' })).toBeVisible();
    expect(
      screen.getByText("Use this if you turned it on in another kitchen's app."),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Use a 6-digit code instead' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Learn more' }));
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('on: the kitchen code, sign out and delete both ask first', async () => {
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    render(wrap(<RememberMeCard kitchenName="Onde Onde" />));
    expect(await screen.findByText('C-7K3M')).toBeVisible();
    expect(screen.getByText('Your customer code at Onde Onde')).toBeVisible();
    expect(screen.getByRole('heading', { name: /Remember me\s*·\s*On/ })).toBeVisible();
    expect(screen.getByText('Your saved address is locked with your passkey.')).toBeVisible();
    expect(screen.queryByText(/choose Passwords/)).toBeNull();

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

  it('on without a lock says the address stays on this phone and where to save', () => {
    setRememberMeLocal({ credentialId: 'c', sealing: false, setup: false });
    render(wrap(<RememberMeCard />));
    expect(screen.getByText(/can't lock your address with your passkey/)).toBeVisible();
    expect(screen.getByText(/choose Passwords \(iPhone\)/)).toBeVisible();
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
    expect(screen.getByRole('button', { name: 'Pakai kode 6 angka saja' })).toBeVisible();
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
  it('has short headings with bullet lists, in both languages, without "sealed"', async () => {
    const first = render(wrap(<PrivacyModal onClose={vi.fn()} />));
    expect(screen.getByRole('heading', { name: 'What we keep' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Remember me (optional)' })).toBeVisible();
    expect(screen.getAllByRole('list')).toHaveLength(7);
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/seal/i);
    expect(screen.getByRole('dialog')).toHaveTextContent('random ID');
    first.unmount();
    await act(() => i18n.changeLanguage('id'));
    render(wrap(<PrivacyModal onClose={vi.fn()} />));
    expect(screen.getByRole('heading', { name: 'Yang kami simpan' })).toBeVisible();
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/segel/i);
    expect(screen.getByRole('dialog')).toHaveTextContent('dikunci dengan passkey-mu');
    await act(() => i18n.changeLanguage('en'));
  });

  it('explains today and Remember me, and closes', () => {
    const onClose = vi.fn();
    render(wrap(<PrivacyModal onClose={onClose} />));
    expect(screen.getByRole('dialog', { name: 'How we keep your data private' })).toBeVisible();
    expect(screen.getByText(/locked with your passkey/)).toBeVisible();
    expect(screen.getByText(/12 months/)).toBeVisible();
    expect(screen.getByText(/Settings > Passwords/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
