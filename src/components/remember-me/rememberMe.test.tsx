import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  signOutHere: vi.fn(() => Promise.resolve()),
  deleteMySavedData: vi.fn(() => Promise.resolve({ ok: true as const, signalled: false })),
  rememberMeAccount: vi.fn(
    (): Promise<{ code: string | null; firstName: string; createdAt: string | null }> =>
      Promise.resolve({
        code: 'C-7K3M',
        firstName: 'Indra',
        createdAt: '2026-10-24T02:00:00.000Z',
      }),
  ),
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
import { PrivacyModal, RememberMeCard, RememberMeTick, RestoreOrders, wantsRememberMe } from '.';
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

describe('the name-step row (plan 096)', () => {
  it('is off by default and the ? opens the explanation as headings and bullets', () => {
    render(wrap(<RememberMeTick />));
    expect(
      screen.getByRole('checkbox', { name: 'Remember me on all my phones' }),
    ).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'What is Remember me?' }));
    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveTextContent("What's a passkey?");
    expect(sheet).toHaveTextContent("Why it's safe");
    expect(sheet).toHaveTextContent('Ordering without it works just the same.');
    expect(within(sheet).getAllByRole('list')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ticking remembers the wish until the order is placed', () => {
    const first = render(wrap(<RememberMeTick />));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(wantsRememberMe()).toBe(true);
    first.unmount();
    render(wrap(<RememberMeTick />));
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(wantsRememberMe()).toBe(false);
  });

  it('is in Indonesian too', async () => {
    await act(() => i18n.changeLanguage('id'));
    render(wrap(<RememberMeTick />));
    expect(screen.getByRole('checkbox', { name: 'Ingat aku di semua HP-ku' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Apa itu Ingat aku?' })).toBeVisible();
  });

  it('is not shown when Remember me is already on', () => {
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    render(wrap(<RememberMeTick />));
    expect(screen.queryByRole('checkbox')).toBeNull();
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

  it('offers "Turned on before? Restore your orders", which signs in instead of making an account', async () => {
    open();
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Turned on Remember me before?')).toBeVisible();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Restore your orders' }));
    await waitFor(() => {
      expect(api.restoreWithPasskey).toHaveBeenCalledTimes(1);
    });
    expect(api.turnOnRememberMe).not.toHaveBeenCalled();
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
  it('off: one Turn on, then the restore line and quiet links', () => {
    render(wrap(<RememberMeCard kitchenName="Onde Onde" />));
    expect(
      screen.getByText(
        /We remember your orders, name and address on this phone and on any other phone/,
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeVisible();
    expect(screen.getByText('Turned on Remember me before?')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restore your orders' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Use a 6-digit code instead' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Learn more' }));
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('off: tapping Restore your orders runs the passkey restore', async () => {
    render(wrap(<RememberMeCard kitchenName="Onde Onde" />));
    fireEvent.click(screen.getByRole('button', { name: 'Restore your orders' }));
    await waitFor(() => {
      expect(api.restoreWithPasskey).toHaveBeenCalledTimes(1);
    });
  });

  it('on: shows the name and when it was turned on, in English', async () => {
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    render(wrap(<RememberMeCard kitchenName="Onde Onde" />));
    expect(await screen.findByText('24 Oct 2026')).toBeVisible();
    expect(screen.getByText('Turned on')).toBeVisible();
    expect(screen.getByText('Name')).toBeVisible();
    expect(screen.getByText('Indra')).toBeVisible();
  });

  it('on: shows the same date in Indonesian', async () => {
    await act(() => i18n.changeLanguage('id'));
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    render(wrap(<RememberMeCard />));
    expect(await screen.findByText('24 Okt 2026')).toBeVisible();
    expect(screen.getByText('Dinyalakan')).toBeVisible();
    expect(screen.getByText('Nama')).toBeVisible();
  });

  it('on: hides the date and name rows when the server sends neither', async () => {
    api.rememberMeAccount.mockResolvedValueOnce({ code: 'C-7K3M', firstName: '', createdAt: null });
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    render(wrap(<RememberMeCard />));
    expect(await screen.findByText('C-7K3M')).toBeVisible();
    expect(screen.queryByText('Turned on')).toBeNull();
    expect(screen.queryByText('Name')).toBeNull();
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
  it('empty My orders offers Restore and confirms how many came back', async () => {
    render(wrap(<RestoreOrders />));
    expect(screen.getByText('Turned on Remember me before?')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Restore your orders' }));
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
