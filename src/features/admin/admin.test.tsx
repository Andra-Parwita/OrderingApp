import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../../mocks/browserPasskeys';
import { clearCookies, installCookieJar, sessionCookie } from '../../../mocks/cookieJar';
import { DEV_ADMIN_SETUP_KEY, mockStores } from '../../../mocks/handlers';
import { adminSetup, registerDevice, signInWithKey, signOut } from '../../api/auth';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { AdminHomeScreen } from './AdminHomeScreen';
import { AdminSetupScreen } from './AdminSetupScreen';
import { AdminSignInScreen } from './AdminSignInScreen';
import { registerAdminI18n } from './i18n/register';

const NO_ADMIN_PASSKEY = 'No admin passkey was used. If this device has none, set it up first.';

function renderThemed(ui: React.ReactNode) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

async function signInAsAdmin() {
  expect((await adminSetup(DEV_ADMIN_SETUP_KEY)).ok).toBe(true);
  expect((await registerDevice({ kind: 'passkey', deviceName: 'Test PC' })).ok).toBe(true);
}

/**
 * Devices for an account, set up straight in the mock store (a key, then a password): no browser
 * session is touched, so the admin stays signed in.
 */
async function addDevices(
  target: { role: 'seller'; sellerId: string } | { role: 'chef'; sellerId: string; chefId: string },
  names: Array<string>,
) {
  const issued = await mockStores.auth.createKey(target, 'invite');
  for (const [index, deviceName] of names.entries()) {
    const started = await mockStores.auth.redeemKey(issued.key, `dev-${String(index)}-abcd-efgh`);
    if (!started.ok) throw new Error(started.error);
    const done = await mockStores.auth.register(started.value.token, {
      kind: 'password',
      password: 'long enough password',
      deviceName,
    });
    if (!done.ok) throw new Error(done.error);
  }
}

const addSellerDevice = (deviceName: string) =>
  addDevices({ role: 'seller', sellerId: 'seller-onde-onde' }, [deviceName]);

const addChefDevices = (chefId: string, count: number) =>
  addDevices(
    { role: 'chef', sellerId: 'seller-onde-onde', chefId },
    Array.from({ length: count }, (_, n) => `Chef phone ${String(n + 1)}`),
  );

// The browser's passkey prompt is a software authenticator; the server's checks are the real ones.
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
afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminSetupScreen', () => {
  it('takes the setup key, then the passkey, once; a second try says an admin exists', async () => {
    const onDone = vi.fn();
    renderThemed(<AdminSetupScreen onDone={onDone} />);
    expect(screen.getByText('This page stops working once an admin exists.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Setup key'), { target: { value: 'wrong-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/That key is not right\./)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Setup key'), {
      target: { value: DEV_ADMIN_SETUP_KEY },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create admin passkey' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open the admin page' }));
    expect(onDone).toHaveBeenCalledTimes(1);

    // The admin now exists: the page refuses, in plain words.
    localStorage.clear();
    clearCookies();
    renderThemed(<AdminSetupScreen onDone={onDone} />);
    const keys = screen.getAllByLabelText('Setup key');
    fireEvent.change(keys[keys.length - 1] as HTMLElement, {
      target: { value: DEV_ADMIN_SETUP_KEY },
    });
    const buttons = screen.getAllByRole('button', { name: 'Continue' });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    expect(
      await screen.findByText('An admin is already set up, so this page no longer works.'),
    ).toBeInTheDocument();
  });
});

describe('AdminSignInScreen', () => {
  it('signs in with the passkey this browser kept', async () => {
    await signInAsAdmin();
    const onSignedIn = vi.fn();
    renderThemed(<AdminSignInScreen onSignedIn={onSignedIn} />);
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with passkey' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
  });

  it('says the admin needs a web address, not an IP address, for a passkey', () => {
    vi.stubGlobal('location', { ...window.location, hostname: '192.168.1.20' });
    renderThemed(<AdminSignInScreen onSignedIn={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Sign in with passkey' })).not.toBeInTheDocument();
    expect(screen.getByText(/Passkeys do not work on an IP address/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('says so when the passkey prompt is closed', async () => {
    await signInAsAdmin();
    renderThemed(<AdminSignInScreen onSignedIn={vi.fn()} />);
    browserPasskeys.failNext('cancel');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with passkey' }));
    expect(await screen.findByText(NO_ADMIN_PASSKEY)).toBeInTheDocument();
  });

  it('says so when the browser has no admin passkey to offer', async () => {
    renderThemed(<AdminSignInScreen onSignedIn={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with passkey' }));
    expect(await screen.findByText(NO_ADMIN_PASSKEY)).toBeInTheDocument();
  });

  it('signs in with nothing stored (discoverable passkey)', async () => {
    await signInAsAdmin();
    localStorage.clear();
    clearCookies();
    const onSignedIn = vi.fn();
    renderThemed(<AdminSignInScreen onSignedIn={onSignedIn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with passkey' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
  });

  it('a seller passkey picked here is refused with a clear message, and nothing is forgotten', async () => {
    await signInAsAdmin();
    const invite = await mockStores.auth.createKey(
      { role: 'seller', sellerId: 'seller-onde-onde' },
      'invite',
    );
    await signOut();
    expect((await signInWithKey(invite.key)).ok).toBe(true);
    expect((await registerDevice({ kind: 'passkey', deviceName: 'Seller PC' })).ok).toBe(true);
    await signOut();
    // The admin hint is gone, so the browser offers all passkeys and the newest is the seller's.
    localStorage.removeItem('passkeyCredential.admin');
    const staffHint = localStorage.getItem('passkeyCredential.staff');
    expect(staffHint).not.toBeNull();
    const onSignedIn = vi.fn();
    renderThemed(<AdminSignInScreen onSignedIn={onSignedIn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with passkey' }));
    expect(
      await screen.findByText(
        'That passkey belongs to a seller. Try again and pick the admin passkey.',
      ),
    ).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(sessionCookie()).toBeNull();
    expect(localStorage.getItem('passkeyCredential.staff')).toBe(staffHint);
  });
});

describe('AdminHomeScreen', () => {
  it('lists sellers with their links and device counts, and no order data', async () => {
    await signInAsAdmin();
    await addSellerDevice('iPhone');
    renderThemed(<AdminHomeScreen />);
    const table = await screen.findByRole('table', { name: 'Sellers' });
    const row = within(table).getByRole('row', { name: /Onde Onde/ });
    expect(row).toHaveTextContent('/onde-onde');
    expect(within(table).getByRole('columnheader', { name: 'Created' })).toBeInTheDocument();
    expect(row).toHaveTextContent('15 Aug'); // the fixed date of the sample seller
    expect(within(table).getByRole('row', { name: /Dapur Demo/ })).toHaveTextContent('20 Sep');
    await waitFor(() => expect(row).toHaveTextContent('1'));
    expect(screen.getByText(/shows no orders, customers or menus/)).toBeInTheDocument();
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nasi campur|lemper/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/this device/)).toBeInTheDocument();
  });

  it('shows why a link cannot be used: bad characters, reserved, taken', async () => {
    await signInAsAdmin();
    renderThemed(<AdminHomeScreen />);
    await screen.findByRole('table', { name: 'Sellers' });
    const link = screen.getByLabelText('Customer link');
    const add = screen.getByRole('button', { name: 'Add seller' });
    fireEvent.change(screen.getByLabelText('Seller name'), { target: { value: 'Warung Baru' } });

    fireEvent.change(link, { target: { value: 'Warung Baru' } });
    expect(
      screen.getByText(/Use lowercase letters, digits and single hyphens/),
    ).toBeInTheDocument();
    expect(add).toBeDisabled();

    fireEvent.change(link, { target: { value: 'admin' } });
    expect(screen.getByText('That link is reserved by the app. Pick another.')).toBeInTheDocument();
    expect(add).toBeDisabled();

    fireEvent.change(link, { target: { value: 'onde-onde' } });
    expect(screen.getByText('That link is already taken. Pick another.')).toBeInTheDocument();
    expect(add).toBeDisabled();

    fireEvent.change(link, { target: { value: 'x' } });
    expect(screen.getByText('Use at least 2 characters.')).toBeInTheDocument();

    fireEvent.change(link, { target: { value: 'warung-baru' } });
    expect(add).toBeEnabled();
  });

  it('adds a seller and lists it', async () => {
    await signInAsAdmin();
    renderThemed(<AdminHomeScreen />);
    await screen.findByRole('table', { name: 'Sellers' });
    fireEvent.change(screen.getByLabelText('Seller name'), { target: { value: 'Warung Baru' } });
    fireEvent.change(screen.getByLabelText('Customer link'), { target: { value: 'warung-baru' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add seller' }));
    expect(
      await screen.findByText('Warung Baru was added. The link is /warung-baru.'),
    ).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Sellers' });
    expect(within(table).getByRole('row', { name: /Warung Baru/ })).toHaveTextContent(
      '/warung-baru',
    );
    expect(await mockStores.sellerBySlug('warung-baru')).toBeDefined();
  });

  it('shows an invite key once, with the 24 hour rule, Copy and a WhatsApp link without a number', async () => {
    await signInAsAdmin();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderThemed(<AdminHomeScreen />);
    const table = await screen.findByRole('table', { name: 'Sellers' });
    fireEvent.click(within(table).getByRole('row', { name: /Onde Onde/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create invite key' }));

    const box = await screen.findByRole('region', { name: 'Invite key for Onde Onde' });
    expect(
      within(box).getByText('Valid for 24 hours, works on up to 3 devices.'),
    ).toBeInTheDocument();
    const key = box.querySelector('code')?.textContent ?? '';
    expect(key).toMatch(/^[A-Z0-9]{3,}(-[A-Z0-9]{3,})+$/);

    const whatsapp = within(box).getByRole('link', { name: 'Send on WhatsApp' });
    const href = whatsapp.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain(key);

    fireEvent.click(within(box).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(key));
    expect(await within(box).findByText('Copied')).toBeInTheDocument();

    // Shown once: after Done the key is gone and nothing else on the page carries it.
    fireEvent.click(within(box).getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(key)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(key);
  });

  it('signs a seller device out on the second tap only', async () => {
    await signInAsAdmin();
    await addSellerDevice('iPad');
    renderThemed(<AdminHomeScreen />);
    const table = await screen.findByRole('table', { name: 'Sellers' });
    fireEvent.click(within(table).getByRole('row', { name: /Onde Onde/ }));
    const list = await screen.findByRole('list', { name: 'Devices' });
    expect(within(list).getByText('iPad')).toBeInTheDocument();

    fireEvent.click(within(list).getByRole('button', { name: 'Sign out' }));
    // First tap only asks again.
    expect(within(list).getByText('iPad')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Tap again to sign out' }));
    expect(await screen.findByText('No devices yet.')).toBeInTheDocument();
  });

  it('lists chefs read-only with devices, and signs a chef out everywhere on the second tap', async () => {
    await signInAsAdmin();
    await addChefDevices('wati', 2);
    renderThemed(<AdminHomeScreen />);
    const table = await screen.findByRole('table', { name: 'Sellers' });
    fireEvent.click(within(table).getByRole('row', { name: /Onde Onde/ }));
    const list = await screen.findByRole('list', { name: 'Chefs' });
    expect(await within(list).findByText('Chef Wati · 2 devices')).toBeInTheDocument();
    expect(
      screen.getByText('Read-only list. The seller adds and invites chefs.'),
    ).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: /rename|delete|add|invite/i })).toBeNull();

    fireEvent.click(within(list).getByRole('button', { name: 'Sign out all' }));
    expect(within(list).getByText('Chef Wati · 2 devices')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Tap again to sign out all' }));
    expect(await within(list).findByText('Chef Wati · 0 devices')).toBeInTheDocument();
    expect(within(list).queryByRole('button')).toBeNull();
    expect(await screen.findByText('No devices yet.')).toBeInTheDocument();
  });

  it('speaks Indonesian in the Created column and the chefs section', async () => {
    await i18n.changeLanguage('id');
    await signInAsAdmin();
    await addChefDevices('wati', 1);
    renderThemed(<AdminHomeScreen />);
    const table = await screen.findByRole('table', { name: 'Penjual' });
    expect(within(table).getByRole('columnheader', { name: 'Dibuat' })).toBeInTheDocument();
    fireEvent.click(within(table).getByRole('row', { name: /Onde Onde/ }));
    const list = await screen.findByRole('list', { name: 'Koki' });
    expect(await within(list).findByText('Chef Wati · 1 perangkat')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Keluarkan semua' })).toBeInTheDocument();
  });
});
