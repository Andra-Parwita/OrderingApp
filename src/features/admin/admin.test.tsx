import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../../mocks/browserPasskeys';
import { clearCookies, installCookieJar, sessionCookie } from '../../../mocks/cookieJar';
import { DEV_ADMIN_SETUP_KEY, mockStores } from '../../../mocks/handlers';
import {
  adminSetup,
  createDeviceCode,
  registerDevice,
  signInWithCode,
  signInWithKey,
  signOut,
} from '../../api/auth';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { AdminHomeScreen } from './AdminHomeScreen';
import { AdminSetupScreen, type AdminSetupScreenProps } from './AdminSetupScreen';
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
 * A person with one device, set up straight in the mock store (a key, then a password): no browser
 * session is touched, so the admin stays signed in. One key admits one device (D-085).
 */
async function addPerson(
  target: { role: 'owner'; sellerId: string } | { role: 'chef'; sellerId: string; chefId: string },
  deviceName: string,
  displayName = 'Test person',
) {
  const issued = await mockStores.auth.createKey({ ...target, displayName });
  const started = await mockStores.auth.redeemKey(issued.key, 'dev-0-abcd-efgh');
  if (!started.ok) throw new Error(started.error);
  const done = await mockStores.auth.register(started.value.token, {
    kind: 'password',
    password: 'long enough password',
    deviceName,
  });
  if (!done.ok) throw new Error(done.error);
}

const addSellerDevice = (deviceName: string) =>
  addPerson({ role: 'owner', sellerId: 'seller-onde-onde' }, deviceName);

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
    const invite = await mockStores.auth.createKey({
      role: 'owner',
      sellerId: 'seller-onde-onde',
      displayName: 'Bu Ani',
    });
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

describe('AdminHomeScreen problems', () => {
  const problem = (message: string) => ({
    app: 'seller' as const,
    version: 'dev',
    slug: 'onde-onde',
    path: '/seller/orders',
    kind: 'api_error' as const,
    code: 'server_error',
    message,
    agent: 'Chrome Android 126',
    standalone: false,
  });

  it('shows an empty state when nothing was reported', async () => {
    await signInAsAdmin();
    renderThemed(<AdminHomeScreen />);
    const toggle = await screen.findByRole('button', { name: 'Problems (0)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(await screen.findByText('No problems reported.')).toBeInTheDocument();
  });

  it('counts the entries and lists them newest first when opened', async () => {
    await signInAsAdmin();
    await mockStores.log.record([problem('first one')]);
    await mockStores.log.record([problem('second one')]);
    renderThemed(<AdminHomeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Problems (2)' }));
    const list = await screen.findByRole('list', { name: 'Recent problems' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('second one');
    expect(items[0]).toHaveTextContent('/seller/orders');
    expect(items[0]).toHaveTextContent('api_error');
    expect(items[0]).toHaveTextContent('server_error');
    expect(items[0]).toHaveTextContent('Chrome Android 126');
    expect(items[1]).toHaveTextContent('first one');
  });

  it('filters by app and kitchen, pages 50 with Older/Newer, and clears on the second tap', async () => {
    await signInAsAdmin();
    for (let n = 1; n <= 52; n += 1) await mockStores.log.record([problem(`seller ${String(n)}`)]);
    await mockStores.log.record([{ ...problem('from customer'), app: 'customer', slug: null }]);
    renderThemed(<AdminHomeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Problems (53)' }));
    const list = await screen.findByRole('list', { name: 'Recent problems' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(50);
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Older' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Recent problems' })).getAllByRole('listitem'),
      ).toHaveLength(3),
    );
    expect(screen.getByText('51-53 of 53')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('App'), { target: { value: 'customer' } });
    await waitFor(() => {
      const items = within(screen.getByRole('list', { name: 'Recent problems' })).getAllByRole(
        'listitem',
      );
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent('from customer');
    });
    fireEvent.change(screen.getByLabelText('App'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Kitchen'), { target: { value: 'onde-onde' } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Problems (52)' })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect((await mockStores.log.list({ offset: 0 }, 1)).total).toBe(53);
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to clear all' }));
    expect(await screen.findByText('No problems reported.')).toBeInTheDocument();
    expect((await mockStores.log.list({ offset: 0 }, 1)).total).toBe(0);
  });
});

describe('AdminHomeScreen', () => {
  it('lists sellers with their links and device counts, and no order data', async () => {
    await signInAsAdmin();
    await addSellerDevice('iPhone');
    renderThemed(<AdminHomeScreen />);
    const list = await screen.findByRole('list', { name: 'Sellers' });
    const row = within(list).getByRole('button', { name: /Onde Onde/ });
    expect(row).toHaveTextContent('/onde-onde');
    expect(row).toHaveTextContent('Created Sat 15 Aug'); // the fixed date of the sample seller
    expect(within(list).getByRole('button', { name: /Dapur Demo/ })).toHaveTextContent('20 Sep');
    await waitFor(() => expect(row).toHaveTextContent('1 device'));
    expect(screen.getByText(/shows no orders or customers/)).toBeInTheDocument();
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nasi campur|lemper/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/this device/)).toBeInTheDocument();
  });

  it('shows why a link cannot be used: bad characters, reserved, taken', async () => {
    await signInAsAdmin();
    renderThemed(<AdminHomeScreen />);
    await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a seller' }));
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
    await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a seller' }));
    fireEvent.change(screen.getByLabelText('Seller name'), { target: { value: 'Warung Baru' } });
    fireEvent.change(screen.getByLabelText('Customer link'), { target: { value: 'warung-baru' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add seller' }));
    expect(
      await screen.findByText('Warung Baru was added. The link is /warung-baru.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Warung Baru' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Sellers' });
    expect(within(list).getByRole('button', { name: /Warung Baru/ })).toHaveTextContent(
      '/warung-baru',
    );
    expect(await mockStores.sellerBySlug('warung-baru')).toBeDefined();
  });

  it('asks for a name, then shows the invite once: link, key, the one-use rule, WhatsApp without a number', async () => {
    await signInAsAdmin();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderThemed(<AdminHomeScreen />);
    const list = await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(within(list).getByRole('button', { name: /Onde Onde/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create invite key' }));

    const box = await screen.findByRole('region', { name: 'Invite key for Onde Onde' });
    fireEvent.change(within(box).getByLabelText('Name of the person'), {
      target: { value: 'Bu Sari' },
    });
    fireEvent.click(within(box).getByRole('button', { name: 'Create invite' }));
    expect(
      await within(box).findByText('Works once, on one device, within 24 hours.'),
    ).toBeInTheDocument();
    const key = box.querySelector('code')?.textContent ?? '';
    expect(key).toMatch(/^[A-Z0-9]{3,}(-[A-Z0-9]{3,})+$/);
    const link = `https://${location.host}/seller/setup?kitchen=onde-onde#key=${key}`;

    const whatsapp = within(box).getByRole('link', { name: 'Send on WhatsApp' });
    const href = whatsapp.getAttribute('href') ?? '';
    expect(href.startsWith('https://api.whatsapp.com/send?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain(link);

    fireEvent.click(within(box).getByRole('button', { name: 'Copy link with key' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link));
    fireEvent.click(within(box).getByRole('button', { name: 'Copy key' }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(key));
    expect(await within(box).findByText('Copied')).toBeInTheDocument();

    // Shown once: after Done the key is gone and nothing else on the page carries it.
    fireEvent.click(within(box).getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(key)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(key);
  });

  it('previews the invite message in its own language, lets the admin edit it, and sends or copies that text (plan 043)', async () => {
    await signInAsAdmin();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderThemed(<AdminHomeScreen />);
    const list = await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(within(list).getByRole('button', { name: /Onde Onde/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create invite key' }));
    const box = await screen.findByRole('region', { name: 'Invite key for Onde Onde' });
    fireEvent.change(within(box).getByLabelText('Name of the person'), {
      target: { value: 'Bu Sari' },
    });
    fireEvent.click(within(box).getByRole('button', { name: 'Create invite' }));
    const preview = await within(box).findByLabelText<HTMLTextAreaElement>(
      'Message (you can edit it before sending)',
    );
    const key = box.querySelector('code')?.textContent ?? '';
    const link = `https://${location.host}/seller/setup?kitchen=onde-onde#key=${key}`;
    expect(preview.value).toContain("Hi Bu Sari! 👋 You're invited to run *Onde Onde*");
    expect(preview.value).toContain(link);

    // The message switches to Indonesian while the page stays English.
    fireEvent.click(within(box).getByRole('radio', { name: 'Bahasa Indonesia' }));
    expect(preview.value).toContain('Halo Bu Sari! 👋 Anda diundang untuk mengelola *Onde Onde*');
    expect(preview.value).toContain(link);
    expect(within(box).getByRole('button', { name: 'Copy message' })).toBeInTheDocument();

    // An edit is what WhatsApp and Copy message get.
    fireEvent.change(preview, { target: { value: `Edited ${link}` } });
    const href = within(box).getByRole('link', { name: 'Send on WhatsApp' }).getAttribute('href');
    expect(href).toBe(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Edited ${link}`)}`);
    fireEvent.click(within(box).getByRole('button', { name: 'Copy message' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`Edited ${link}`));
  });

  it('lists the newest invitations of a kitchen: waiting, used and expired (plan 043)', async () => {
    await signInAsAdmin();
    await addPerson({ role: 'owner', sellerId: 'seller-onde-onde' }, 'iPad', 'Bu Ani');
    await mockStores.auth.createKey({
      role: 'owner',
      sellerId: 'seller-onde-onde',
      displayName: 'Pak Budi',
    });
    renderThemed(<AdminHomeScreen />);
    const sellers = await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(within(sellers).getByRole('button', { name: /Onde Onde/ }));
    const list = await screen.findByRole('list', { name: 'Recent invitations' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(list).getByText(/^Waiting, expires /)).toBeInTheDocument();
    expect(within(list).getByText(/^Used /)).toBeInTheDocument();
    expect(within(list).getByText('Pak Budi')).toBeInTheDocument();
    expect(within(list).getAllByText(/^Owner · sent /)).toHaveLength(2);
    // The key itself is never shown again.
    expect(list.textContent).not.toMatch(/[A-Z0-9]{3,}-[A-Z0-9]{3,}/);
    await i18n.changeLanguage('id');
    expect(await screen.findByText(/^Menunggu, berakhir /)).toBeInTheDocument();
  });

  it('lists the people of a kitchen and removes one on the second tap only', async () => {
    await signInAsAdmin();
    await addPerson({ role: 'owner', sellerId: 'seller-onde-onde' }, 'iPad', 'Bu Ani');
    renderThemed(<AdminHomeScreen />);
    const sellers = await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(within(sellers).getByRole('button', { name: /Onde Onde/ }));
    const list = await screen.findByRole('list', { name: 'People' });
    expect(await within(list).findByText('Bu Ani')).toBeInTheDocument();
    expect(within(list).getByText('Owner · 1 device')).toBeInTheDocument();

    fireEvent.click(within(list).getByRole('button', { name: 'Remove' }));
    // First tap only asks again.
    expect(within(list).getByText('Bu Ani')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Tap again to remove' }));
    expect(await screen.findByText('Nobody has joined yet.')).toBeInTheDocument();
  });

  it('switches a kitchen into and out of demo mode (plan 013), in both languages', async () => {
    await signInAsAdmin();
    renderThemed(<AdminHomeScreen />);
    const list = await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(within(list).getByRole('button', { name: /Onde Onde/ }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    const box = await screen.findByRole('checkbox', { name: 'Demo kitchen' });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Demo kitchen' })).toBeChecked(),
    );
    expect((await mockStores.sellerBySlug('onde-onde'))?.seller.demo).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Demo kitchen' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Demo kitchen' })).not.toBeChecked(),
    );
    expect((await mockStores.sellerBySlug('onde-onde'))?.seller.demo).toBe(false);
    await i18n.changeLanguage('id');
    expect(await screen.findByRole('checkbox', { name: 'Dapur demo' })).toBeInTheDocument();
  });

  it('pauses a kitchen two ways and resumes it (plan 032), with a state label in both languages', async () => {
    await signInAsAdmin();
    renderThemed(<AdminHomeScreen />);
    const list = await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(within(list).getByRole('button', { name: /Onde Onde/ }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText('Open')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume the kitchen' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close to customers' }));
    expect(await screen.findAllByText('Closed to customers')).toHaveLength(2); // row and panel
    expect((await mockStores.sellerBySlug('onde-onde'))?.seller.paused).toBe('customers');

    // The full pause signs people out, so it asks twice.
    fireEvent.click(screen.getByRole('button', { name: 'Pause the kitchen' }));
    expect(await mockStores.sellerBySlug('onde-onde')).toMatchObject({
      seller: { paused: 'customers' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tap again: this signs everyone out' }));
    expect(await screen.findAllByText('Paused')).toHaveLength(2);
    expect((await mockStores.sellerBySlug('onde-onde'))?.seller.paused).toBe('full');

    await i18n.changeLanguage('id');
    expect(await screen.findByRole('button', { name: 'Lanjutkan dapur' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lanjutkan dapur' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Lanjutkan dapur' })).toBeNull(),
    );
    expect((await mockStores.sellerBySlug('onde-onde'))?.seller.paused).toBeUndefined();
  });

  it('speaks Indonesian in the Created column and the people section', async () => {
    await i18n.changeLanguage('id');
    await signInAsAdmin();
    await addPerson(
      { role: 'chef', sellerId: 'seller-onde-onde', chefId: 'wati' },
      'Chef phone',
      'Wati',
    );
    renderThemed(<AdminHomeScreen />);
    const sellers = await screen.findByRole('list', { name: 'Penjual' });
    const row = within(sellers).getByRole('button', { name: /Onde Onde/ });
    expect(row).toHaveTextContent('Dibuat');
    fireEvent.click(row);
    const list = await screen.findByRole('list', { name: 'Orang' });
    expect(await within(list).findByText('Koki · 1 perangkat')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Hapus' })).toBeInTheDocument();
  });
});

/** An admin on this browser makes a code, then the browser forgets its session (the new device). */
async function adminCode(): Promise<string> {
  await signInAsAdmin();
  const made = await createDeviceCode();
  if (!made.ok) throw new Error('no code');
  clearCookies();
  return made.data.code;
}

/** A stand-in for the seller screen the app layer supplies: one button that redeems the code. */
const fakeCodeScreen =
  (code: string): NonNullable<AdminSetupScreenProps['codeScreen']> =>
  ({ onSession }) => (
    <button
      type="button"
      onClick={() =>
        void signInWithCode(code).then((result) => {
          if (result.ok) onSession(result.data.me);
        })
      }
    >
      Use code
    </button>
  );

describe('AdminSetupScreen with a 6-digit code (plan 027)', () => {
  it('takes an admin code, offers the guessed device name, and finishes', async () => {
    const code = await adminCode();
    const onDone = vi.fn();
    renderThemed(
      <AdminSetupScreen onDone={onDone} initialMethod="code" codeScreen={fakeCodeScreen(code)} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use code' }));
    const name = await screen.findByLabelText('Name of this device');
    expect(name).toHaveValue('Computer');
    fireEvent.change(name, { target: { value: 'Andra laptop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create admin passkey' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open the admin page' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('refuses a kitchen code and ends that session', async () => {
    const started = await signInWithKey(
      (
        await mockStores.auth.createKey({
          role: 'owner',
          sellerId: 'seller-onde-onde',
          displayName: 'Bu Ani',
        })
      ).key,
    );
    expect(started.ok).toBe(true);
    expect(
      (
        await registerDevice({
          kind: 'password',
          password: 'long enough password',
          deviceName: 'Seller PC 2',
        })
      ).ok,
    ).toBe(true);
    const made = await createDeviceCode();
    if (!made.ok) throw new Error('no code');
    clearCookies();
    renderThemed(
      <AdminSetupScreen
        onDone={vi.fn()}
        initialMethod="code"
        codeScreen={fakeCodeScreen(made.data.code)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use code' }));
    expect(
      await screen.findByText(
        'This code is for a kitchen, not the admin. Use it on the seller sign-in page.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Name of this device')).not.toBeInTheDocument();
    expect(sessionCookie()).toBeNull();
  });
});

describe('AdminHomeScreen two panels (plan 038)', () => {
  it('shows the admin devices and Add a device with no panel open', async () => {
    await signInAsAdmin();
    renderThemed(<AdminHomeScreen />);
    expect(await screen.findByRole('list', { name: 'Your admin devices' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a device' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    const sellers = await screen.findByRole('list', { name: 'Sellers' });
    for (const row of within(sellers).getAllByRole('button')) {
      expect(row).not.toHaveAttribute('aria-current', 'true');
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Seller name')).not.toBeInTheDocument();
  });

  it('opens a seller in a right-hand panel on Invitations, with tabs, and closes it with Esc or Close', async () => {
    await signInAsAdmin();
    await addPerson({ role: 'owner', sellerId: 'seller-onde-onde' }, 'iPad', 'Bu Ani');
    renderThemed(<AdminHomeScreen images={() => <p>Pictures editor</p>} />);
    const sellers = await screen.findByRole('list', { name: 'Sellers' });
    const onde = within(sellers).getByRole('button', { name: /Onde Onde/ });
    onde.focus();
    fireEvent.click(onde);
    const dialog = await screen.findByRole('dialog', { name: 'Onde Onde' });
    expect(onde).toHaveAttribute('aria-current', 'true');
    expect(within(sellers).getByRole('button', { name: /Dapur Demo/ })).not.toHaveAttribute(
      'aria-current',
      'true',
    );
    const invitations = within(dialog).getByRole('tab', { name: 'Invitations' });
    const settings = within(dialog).getByRole('tab', { name: 'Settings' });
    expect(invitations).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('tabpanel')).toBeInTheDocument();
    const people = await within(dialog).findByRole('list', { name: 'People' });
    expect(within(people).getByText('Bu Ani')).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: 'Demo kitchen' })).toBeNull();

    // Arrow keys move between the tabs.
    invitations.focus();
    fireEvent.keyDown(invitations, { key: 'ArrowRight' });
    expect(settings).toHaveAttribute('aria-selected', 'true');
    expect(settings).toHaveFocus();
    expect(within(dialog).getByRole('checkbox', { name: 'Demo kitchen' })).toBeInTheDocument();
    expect(within(dialog).getByText('Pictures editor')).toBeInTheDocument();
    fireEvent.keyDown(settings, { key: 'ArrowLeft' });
    expect(invitations).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onde).toHaveFocus();
    expect(onde).not.toHaveAttribute('aria-current', 'true');

    fireEvent.click(onde);
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens the Add a seller form in the same kind of panel', async () => {
    await signInAsAdmin();
    renderThemed(<AdminHomeScreen />);
    await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a seller' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a seller' });
    expect(within(dialog).getByLabelText('Seller name')).toBeInTheDocument();
  });
});

describe('AdminHomeScreen row summary (plan 038 stage 3)', () => {
  it('shows people, the live menu with its orders, and last activity on the collapsed row', async () => {
    await signInAsAdmin();
    await addSellerDevice('iPhone');
    renderThemed(<AdminHomeScreen />);
    const sellers = await screen.findByRole('list', { name: 'Sellers' });
    const row = within(sellers).getByRole('button', { name: /Onde Onde/ });
    await waitFor(() => expect(row).toHaveTextContent('1 person'));
    expect(row).toHaveTextContent(/Live · \w{3} \d+ \w{3} · 0 orders/);
    expect(row).toHaveTextContent(/Active /);
  });
});

describe('AdminHomeScreen own devices (plan 027)', () => {
  it('renames this device and shows the new name', async () => {
    await signInAsAdmin();
    renderThemed(<AdminHomeScreen />);
    const list = await screen.findByRole('list', { name: 'Your admin devices' });
    expect(within(list).getByText('Test PC')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('New name for Test PC'), {
      target: { value: 'Andra iPad' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Andra iPad')).toBeInTheDocument();
    expect(screen.queryByText('Test PC')).not.toBeInTheDocument();
  });
});

describe('AdminHomeScreen refresh (plan 052)', () => {
  const calls = (spy: { mock: { calls: Array<Array<unknown>> } }, part: string) =>
    spy.mock.calls.filter(([input]) => String(input).includes(part)).length;

  it('shows when it was updated, refreshes list, problems and the open panel, and waits 60 s', async () => {
    await signInAsAdmin();
    await addPerson({ role: 'owner', sellerId: 'seller-onde-onde' }, 'iPad', 'Bu Ani');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderThemed(<AdminHomeScreen />);
    const sellers = await screen.findByRole('list', { name: 'Sellers' });
    await waitFor(() =>
      expect(screen.getByText(/Last updated \d\d:\d\d · just now/)).toBeVisible(),
    );
    fireEvent.click(within(sellers).getByRole('button', { name: /Onde Onde/ }));
    await screen.findByRole('list', { name: 'People' });
    await waitFor(() => expect(calls(fetchSpy, '/invites')).toBe(1));

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    try {
      const before = {
        list: calls(fetchSpy, '/api/admin/sellers') - calls(fetchSpy, '/sellers/'),
        log: calls(fetchSpy, '/api/admin/log'),
        invites: calls(fetchSpy, '/invites'),
      };
      const button = screen.getByRole('button', { name: 'Refresh' });
      fireEvent.click(button);
      await waitFor(() => expect(calls(fetchSpy, '/invites')).toBe(before.invites + 1));
      expect(calls(fetchSpy, '/api/admin/log')).toBe(before.log + 1);
      expect(calls(fetchSpy, '/api/admin/sellers') - calls(fetchSpy, '/sellers/')).toBe(
        before.list + 1,
      );
      expect(screen.getByRole('button', { name: 'Refresh in 60 s' })).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(45_000);
      });
      expect(screen.getByRole('button', { name: 'Refresh in 15 s' })).toBeDisabled();
      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
      expect(screen.getByText(/Last updated \d\d:\d\d · 1 minute ago/)).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });
});
