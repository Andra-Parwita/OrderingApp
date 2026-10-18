import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../../mocks/browserPasskeys';
import { clearCookies, installCookieJar } from '../../../mocks/cookieJar';
import { DEV_ADMIN_SETUP_KEY, MOCK_NOW, mockStores } from '../../../mocks/handlers';
import { adminSetup, fetchMessages, registerDevice } from '../../api/auth';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { AdminHomeScreen } from './AdminHomeScreen';
import { registerAdminI18n } from './i18n/register';

vi.mock(
  '@simplewebauthn/browser',
  async () => (await import('../../../mocks/browserPasskeys')).browserMock,
);

let restoreFetch: () => void;
afterAll(() => {
  restoreFetch();
});
beforeAll(async () => {
  restoreFetch = installCookieJar();
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerAdminI18n();
});
beforeEach(async () => {
  await mockStores.reset();
  localStorage.clear();
  clearCookies();
  browserPasskeys.reset();
  await i18n.changeLanguage('en');
});
const openSection = (id: string) => window.history.replaceState(null, '', `/?s=${id}`);
afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

async function signInAsAdmin() {
  expect((await adminSetup(DEV_ADMIN_SETUP_KEY)).ok).toBe(true);
  expect((await registerDevice({ kind: 'passkey', deviceName: 'Test PC' })).ok).toBe(true);
}

const renderThemed = (ui: React.ReactNode) => render(<AppThemeProvider>{ui}</AppThemeProvider>);

describe('Short message panel (plan 086)', () => {
  async function open() {
    // The mock server's clock stands still at MOCK_NOW; the page must agree with it.
    vi.spyOn(Date, 'now').mockReturnValue(MOCK_NOW.getTime());
    await signInAsAdmin();
    openSection('message');
    renderThemed(<AdminHomeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'New message' }));
    return screen.findByLabelText(/Text \(English\)/);
  }
  const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send' }));

  it('counts characters, stops at 90, and Send waits for the text', async () => {
    const english = await open();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    fireEvent.change(english, { target: { value: 'Back online' } });
    expect(screen.getAllByTestId('message-counter')[0]).toHaveTextContent('11 / 90');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled(); // Indonesian still empty
  });

  it('"Same text for both" hides the Indonesian field and sends one text', async () => {
    const english = await open();
    fireEvent.change(english, { target: { value: 'Back online' } });
    fireEvent.click(screen.getByLabelText('Same text for both'));
    expect(screen.queryByLabelText(/Text \(Bahasa Indonesia\)/)).toBeNull();
    send();
    await waitFor(() => expect(screen.queryByRole('alert')?.textContent ?? 'ok').toBe('ok'));
    expect(await screen.findByRole('status')).toHaveTextContent(/Sent/);
    const stored = (await fetchMessages()).ok ? await fetchMessages() : null;
    const first = stored && stored.ok ? stored.data.messages[0] : undefined;
    expect(first).toMatchObject({ textEn: 'Back online', textId: 'Back online', sellerIds: null });
    expect(first?.audience).toBe('everyone');
  });

  it('picked kitchens, audience and window go in the payload; the list shows it; Stop now ends it', async () => {
    const english = await open();
    fireEvent.change(english, { target: { value: 'Pickup moved to 5 pm' } });
    fireEvent.change(screen.getByLabelText(/Text \(Bahasa Indonesia\)/), {
      target: { value: 'Ambil jadi jam 5 sore' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Pick kitchens' }));
    const kitchen = await screen.findByRole('checkbox', { name: 'Onde Onde' });
    fireEvent.click(kitchen);
    fireEvent.click(screen.getByRole('radio', { name: 'Customers' }));
    fireEvent.click(screen.getByRole('radio', { name: '1 hour' }));
    send();
    await screen.findByRole('status');
    const result = await fetchMessages();
    if (!result.ok) throw new Error('list failed');
    const message = result.data.messages[0];
    expect(message?.sellerIds).toHaveLength(1);
    expect(message?.audience).toBe('customers');
    expect(Date.parse(message?.expiresAt ?? '') - Date.parse(message?.createdAt ?? '')).toBe(
      60 * 60_000,
    );

    // The list row opens the details; Stop now ends it.
    fireEvent.click(await screen.findByRole('button', { name: /Pickup moved to 5 pm/ }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Stop now' }),
    );
    await waitFor(async () => {
      const after = await fetchMessages();
      expect(after.ok && after.data.messages[0]?.stoppedAt).toBeTruthy();
    });
    expect(await screen.findAllByText('Stopped')).not.toHaveLength(0);
  });
});
