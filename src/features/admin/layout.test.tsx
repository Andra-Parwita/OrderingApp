import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../../mocks/browserPasskeys';
import { clearCookies, installCookieJar } from '../../../mocks/cookieJar';
import { DEV_ADMIN_SETUP_KEY, mockStores } from '../../../mocks/handlers';
import { adminSetup, createDeviceCode, registerDevice, signInWithCode } from '../../api/auth';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { AdminHomeScreen } from './AdminHomeScreen';
import { registerAdminI18n } from './i18n/register';
import { COLUMN_DEFAULT, COLUMN_KEY, COLUMN_MAX, COLUMN_MIN } from './useColumnWidth';

// Plan 078: the pinned header, the short menu with its sections, the device rows, the resizable
// menu column and the phone dropdown.

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
  window.history.replaceState(null, '', '/');
  await i18n.changeLanguage('en');
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function signInAsAdmin() {
  expect((await adminSetup(DEV_ADMIN_SETUP_KEY)).ok).toBe(true);
  expect((await registerDevice({ kind: 'passkey', deviceName: 'Test PC' })).ok).toBe(true);
}

const renderScreen = () =>
  render(
    <AppThemeProvider>
      <AdminHomeScreen />
    </AppThemeProvider>,
  );

const menu = () => screen.getByRole('navigation', { name: 'Admin sections' });
const handle = () => screen.getByRole('separator', { name: 'Resize menu' });

describe('Admin sections (plan 078)', () => {
  it('starts on Sellers, keeps the chosen section in the address, and follows Back', async () => {
    await signInAsAdmin();
    renderScreen();
    expect(await screen.findByRole('list', { name: 'Sellers' })).toBeInTheDocument();
    expect(within(menu()).getByRole('button', { name: /^Sellers/ })).toHaveAttribute(
      'aria-current',
      'true',
    );

    fireEvent.click(within(menu()).getByRole('button', { name: /^Your devices/ }));
    expect(window.location.search).toBe('?s=devices');
    expect(await screen.findByRole('list', { name: 'Your admin devices' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Sellers' })).not.toBeInTheDocument();

    fireEvent.click(within(menu()).getByRole('button', { name: /^Sellers/ }));
    expect(window.location.search).toBe('');

    act(() => {
      window.history.replaceState(null, '', '/?s=settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByLabelText('Backup check, customers')).toBeInTheDocument();
  });

  it('opens on the section named in the address and ignores an unknown one', async () => {
    await signInAsAdmin();
    window.history.replaceState(null, '', '/?s=announce');
    const first = renderScreen();
    expect(await screen.findByRole('button', { name: 'Announce' })).toBeInTheDocument();
    first.unmount();

    window.history.replaceState(null, '', '/?s=nonsense');
    renderScreen();
    expect(await screen.findByRole('list', { name: 'Sellers' })).toBeInTheDocument();
  });

  it('shows the counts, and a dot once a notice is set', async () => {
    await signInAsAdmin();
    renderScreen();
    await waitFor(() =>
      expect(within(menu()).getByRole('button', { name: /^Sellers/ })).toHaveTextContent(/\d/),
    );
    await waitFor(() =>
      expect(within(menu()).getByRole('button', { name: /^Your devices/ })).toHaveTextContent('1'),
    );
    expect(within(menu()).getByRole('button', { name: /^Problems/ })).toHaveTextContent('0');
    expect(within(menu()).queryByText(/notice set/)).not.toBeInTheDocument();

    fireEvent.click(within(menu()).getByRole('button', { name: /^Announce/ }));
    fireEvent.change(await screen.findByLabelText('Date'), { target: { value: '2099-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Announce' }));
    expect(await within(menu()).findByText(/notice set/)).toBeInTheDocument();
  });

  it('chooses the section from the phone dropdown', async () => {
    await signInAsAdmin();
    renderScreen();
    const pick = screen.getByRole('combobox', { name: 'Section' });
    expect(pick).toHaveValue('sellers');
    await waitFor(() =>
      expect(
        within(pick).getByRole('option', { name: /^Your devices \(1\)$/ }),
      ).toBeInTheDocument(),
    );
    expect(within(pick).getByRole('option', { name: /^Sellers \(\d+\)$/ })).toBeInTheDocument();
    fireEvent.change(pick, { target: { value: 'devices' } });
    expect(window.location.search).toBe('?s=devices');
    expect(await screen.findByRole('list', { name: 'Your admin devices' })).toBeInTheDocument();
  });
});

describe('Your devices rows (plan 078)', () => {
  it('rename is an icon button with a name; this device has no sign-out icon', async () => {
    await signInAsAdmin();
    window.history.replaceState(null, '', '/?s=devices');
    renderScreen();
    const list = await screen.findByRole('list', { name: 'Your admin devices' });
    expect(within(list).getByText('this device')).toBeInTheDocument();
    const rename = within(list).getByRole('button', { name: 'Rename Test PC' });
    expect(rename).toHaveAttribute('title', 'Rename Test PC');
    expect(within(list).queryByRole('button', { name: /^Sign out/ })).not.toBeInTheDocument();
    fireEvent.click(rename);
    expect(screen.getByLabelText('New name for Test PC')).toBeInTheDocument();
  });

  it('signs another device out on the second tap of its icon', async () => {
    await signInAsAdmin();
    const made = await createDeviceCode();
    if (!made.ok) throw new Error('no code');
    clearCookies();
    expect((await signInWithCode(made.data.code)).ok).toBe(true);
    expect((await registerDevice({ kind: 'passkey', deviceName: 'Second PC' })).ok).toBe(true);

    window.history.replaceState(null, '', '/?s=devices');
    renderScreen();
    const list = await screen.findByRole('list', { name: 'Your admin devices' });
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2));
    fireEvent.click(within(list).getByRole('button', { name: 'Sign out Test PC' }));
    fireEvent.click(within(list).getByRole('button', { name: 'Tap again to sign out' }));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
    expect(within(list).queryByText('Test PC')).not.toBeInTheDocument();
  });
});

describe('Resizable menu column (plan 078)', () => {
  it('is a vertical separator with its value and bounds, at the default width', async () => {
    await signInAsAdmin();
    renderScreen();
    expect(handle()).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle()).toHaveAttribute('aria-valuenow', String(COLUMN_DEFAULT));
    expect(handle()).toHaveAttribute('aria-valuemin', String(COLUMN_MIN));
    expect(handle()).toHaveAttribute('aria-valuemax', String(COLUMN_MAX));
    expect(menu().style.width).toBe(`${COLUMN_DEFAULT}rem`);
  });

  it('changes by 1rem with the arrow keys, stays within the bounds and is remembered', async () => {
    await signInAsAdmin();
    renderScreen();
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(handle()).toHaveAttribute('aria-valuenow', String(COLUMN_DEFAULT + 1));
    expect(localStorage.getItem(COLUMN_KEY)).toBe(String(COLUMN_DEFAULT + 1));
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    expect(handle()).toHaveAttribute('aria-valuenow', String(COLUMN_DEFAULT - 1));
    for (let n = 0; n < 5; n += 1) fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    expect(handle()).toHaveAttribute('aria-valuenow', String(COLUMN_MIN));
    for (let n = 0; n < 30; n += 1) fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(handle()).toHaveAttribute('aria-valuenow', String(COLUMN_MAX));
  });

  it('opens at the saved width, and a double-click goes back to the default and forgets it', async () => {
    await signInAsAdmin();
    localStorage.setItem(COLUMN_KEY, '20');
    renderScreen();
    expect(handle()).toHaveAttribute('aria-valuenow', '20');
    fireEvent.doubleClick(handle());
    expect(handle()).toHaveAttribute('aria-valuenow', String(COLUMN_DEFAULT));
    expect(localStorage.getItem(COLUMN_KEY)).toBeNull();
  });

  it('ignores a saved width outside the bounds', async () => {
    await signInAsAdmin();
    localStorage.setItem(COLUMN_KEY, '99');
    renderScreen();
    expect(handle()).toHaveAttribute('aria-valuenow', String(COLUMN_DEFAULT));
  });
});
