import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../../mocks/browserPasskeys';
import { clearCookies, installCookieJar } from '../../../mocks/cookieJar';
import { DEV_ADMIN_SETUP_KEY, mockStores } from '../../../mocks/handlers';
import { adminSetup, registerDevice } from '../../api/auth';
import { fetchStatus } from '../../api/status';
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

describe('Maintenance panel (plan 046)', () => {
  it('announces an update, turns maintenance on and off, and clears the announcement', async () => {
    await signInAsAdmin();
    openSection('announce');
    renderThemed(<AdminHomeScreen />);
    expect(
      await screen.findByText('Maintenance is off. The app works as usual.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-11' } });
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '22:00' } });
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Note \(English/), { target: { value: 'Upgrade' } });
    fireEvent.click(screen.getByRole('button', { name: 'Announce' }));
    expect(await screen.findByText(/Announced: .*15 min\./)).toBeInTheDocument();
    const stored = await fetchStatus();
    expect(stored?.notice).toMatchObject({ noteEn: 'Upgrade' });
    expect(Date.parse(stored?.notice?.until ?? '') - Date.parse(stored?.notice?.from ?? '')).toBe(
      15 * 60_000,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Turn maintenance on' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tap again to turn on' }));
    expect(await screen.findByText(/Maintenance is ON/)).toBeInTheDocument();
    expect((await fetchStatus())?.maintenance).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Turn maintenance off' }));
    await waitFor(async () => expect((await fetchStatus())?.maintenance).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: 'Clear announcement' }));
    expect(await screen.findByText('No update announced.')).toBeInTheDocument();
  });

  it('is not shown to someone who is not signed in as the admin', async () => {
    renderThemed(<AdminHomeScreen onSignInNeeded={() => undefined} />);
    await waitFor(() => expect(screen.queryByText('Announce an update')).not.toBeInTheDocument());
  });
});

describe('Backup check panel (plan 074)', () => {
  it('saves the two minutes, refuses a value out of 1 to 30, and the status carries them', async () => {
    await signInAsAdmin();
    openSection('settings');
    renderThemed(<AdminHomeScreen />);
    const customers = await screen.findByLabelText('Backup check, customers');
    const sellers = screen.getByLabelText('Backup check, sellers');
    expect(customers).toHaveValue(5);
    fireEvent.change(sellers, { target: { value: '31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter 1 to 30 minutes.');
    fireEvent.change(sellers, { target: { value: '2' } });
    fireEvent.change(customers, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    await waitFor(async () =>
      expect((await fetchStatus())?.backupMinutes).toEqual({ customer: 10, seller: 2 }),
    );
  });
});
