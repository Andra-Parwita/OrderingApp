import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../../mocks/browserPasskeys';
import { clearCookies, installCookieJar, sessionCookie } from '../../../mocks/cookieJar';
import { MOCK_NOW, mockStores } from '../../../mocks/handlers';
import { createDeviceCode, fetchMe, registerDevice, signInWithKey } from '../../api/auth';
import { fetchMenu, fetchMyOrders, fetchSellerOrders, placeOrder } from '../../api/client';
import { getCredentialId } from '../../api/device/session';
import { cleanCode, cleanKey, guessDevice } from './authText';
import { DevicesScreen } from './DevicesScreen';
import { PasskeyHelpScreen } from './PasskeyHelpScreen';
import { PasswordSetupScreen } from './PasswordSetupScreen';
import { DeviceCodeScreen, SetupKeyScreen } from './SetupKeyScreen';
import { SignInScreen } from './SignInScreen';
import {
  PASSWORD,
  adminPasskeyOnThisBrowser,
  inviteKey,
  renderScreen,
  sellerId,
  setupI18n,
  signInAsSeller,
  signOut,
  startSetup,
} from './testSupport';

// The browser's passkey prompt is a software authenticator; the server's checks are the real ones.
vi.mock(
  '@simplewebauthn/browser',
  async () => (await import('../../../mocks/browserPasskeys')).browserMock,
);

let restoreFetch: () => void;
beforeAll(async () => {
  restoreFetch = installCookieJar();
  await setupI18n();
});
afterAll(() => {
  restoreFetch();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
});
beforeEach(async () => {
  await mockStores.reset();
  localStorage.clear();
  clearCookies();
  browserPasskeys.reset();
});

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
/** Paste into the code boxes (the n-th box has the cursor). */
const pasteCode = (text: string, n = 1) =>
  fireEvent.paste(screen.getByLabelText(`Digit ${String(n)} of 6`), {
    clipboardData: { getData: () => text },
  });

describe('input helpers', () => {
  it('cleans keys and codes, and guesses the device', () => {
    expect(cleanKey(' dlv-ab12 cd34 ')).toBe('DLVAB12CD34');
    expect(cleanCode('123 456 789')).toBe('123456');
    expect(guessDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iphone');
    expect(guessDevice('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('ipad');
    expect(guessDevice('Mozilla/5.0 (Linux; Android 14; Pixel 7)')).toBe('android');
    expect(guessDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('computer');
  });
});

describe('SetupKeyScreen', () => {
  it('accepts a key typed in small letters with spaces', async () => {
    const key = await inviteKey();
    const onSession = vi.fn();
    renderScreen(<SetupKeyScreen onSession={onSession} onUseCode={vi.fn()} />);
    type('Invite key from the kitchen owner', key.toLowerCase().replaceAll('-', '  '));
    press('Continue');
    await waitFor(() => expect(onSession).toHaveBeenCalledTimes(1));
    expect(onSession.mock.calls[0]?.[0]).toMatchObject({ role: 'seller', stage: 'setup' });
    expect(sessionCookie()).toBeTruthy();
  });

  it('asks for a key when the field is empty', () => {
    renderScreen(<SetupKeyScreen onSession={vi.fn()} onUseCode={vi.fn()} />);
    press('Continue');
    expect(screen.getByText('Type the key you were sent.')).toBeInTheDocument();
  });

  it('says how many tries are left, then locks with minutes', async () => {
    const onSession = vi.fn();
    renderScreen(<SetupKeyScreen onSession={onSession} onUseCode={vi.fn()} />);
    type('Invite key from the kitchen owner', 'wrong key');
    press('Continue');
    expect(
      await screen.findByText('That did not work. Check it and try again. 4 tries left.'),
    ).toBeInTheDocument();
    for (let tries = 3; tries >= 1; tries--) {
      press('Continue');
      await screen.findByText(
        `That did not work. Check it and try again. ${String(tries)} ${tries === 1 ? 'try' : 'tries'} left.`,
      );
    }
    press('Continue');
    expect(await screen.findByText('Too many tries. Try again in 15 minutes.')).toBeInTheDocument();
    expect(onSession).not.toHaveBeenCalled();
    expect(sessionCookie()).toBeNull();
  });

  it('switches to the code screen from the segmented control', () => {
    const onUseCode = vi.fn();
    renderScreen(<SetupKeyScreen onSession={vi.fn()} onUseCode={onUseCode} />);
    expect(screen.getByRole('radio', { name: 'Invite key' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '6-digit code' }));
    expect(onUseCode).toHaveBeenCalled();
  });

  it('shows the error under the field, never as a popup', async () => {
    renderScreen(<SetupKeyScreen onSession={vi.fn()} onUseCode={vi.fn()} />);
    type('Invite key from the kitchen owner', 'wrong key');
    press('Continue');
    const field = screen.getByLabelText('Invite key from the kitchen owner');
    expect(await screen.findByText(/That did not work/)).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('DeviceCodeScreen', () => {
  it('takes a code with a space in it and starts setup', async () => {
    await signInAsSeller('password');
    const code = await createDeviceCode();
    if (!code.ok) throw new Error('no code');
    clearCookies(); // the other device has no session yet
    const onSession = vi.fn();
    renderScreen(<DeviceCodeScreen onSession={onSession} onUseKey={vi.fn()} />);
    pasteCode(`${code.data.code.slice(0, 3)} ${code.data.code.slice(3)}`);
    press('Continue');
    await waitFor(() => expect(onSession).toHaveBeenCalledTimes(1));
    expect(onSession.mock.calls[0]?.[0]).toMatchObject({ role: 'seller', stage: 'setup' });
  });

  it('refuses a short or wrong code in plain words', async () => {
    renderScreen(<DeviceCodeScreen onSession={vi.fn()} onUseKey={vi.fn()} />);
    pasteCode('12');
    press('Continue');
    expect(screen.getByText('Type all 6 digits of the code.')).toBeInTheDocument();
    pasteCode('000000');
    press('Continue');
    expect(
      await screen.findByText('That did not work. Check it and try again. 4 tries left.'),
    ).toBeInTheDocument();
  });

  it('switches back to the invite key from the segmented control', () => {
    const onUseKey = vi.fn();
    renderScreen(<DeviceCodeScreen onSession={vi.fn()} onUseKey={onUseKey} />);
    expect(screen.getByRole('radio', { name: '6-digit code' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Invite key' }));
    expect(onUseKey).toHaveBeenCalled();
  });

  it('moves on as digits are typed, goes back on Backspace, and takes a paste in the middle', () => {
    renderScreen(<DeviceCodeScreen onSession={vi.fn()} onUseKey={vi.fn()} />);
    const box = (n: number) => screen.getByLabelText(`Digit ${String(n)} of 6`);
    fireEvent.change(box(1), { target: { value: '4' } });
    expect(box(1)).toHaveValue('4');
    expect(box(2)).toHaveFocus();
    fireEvent.change(box(2), { target: { value: '2' } });
    expect(box(3)).toHaveFocus();
    fireEvent.keyDown(box(3), { key: 'Backspace' });
    expect(box(2)).toHaveFocus();
    expect(box(2)).toHaveValue('');
    pasteCode('987 654', 4);
    expect([1, 2, 3, 4, 5, 6].map((n) => (box(n) as HTMLInputElement).value).join('')).toBe(
      '987654',
    );
  });
});

const FACE = /^Face or fingerprint/;
const SET_PASSWORD = /^Set a password/;

describe('PasskeyHelpScreen (Create)', () => {
  it('welcomes by first name and creates a real passkey in one tap', async () => {
    await startSetup();
    const onDone = vi.fn();
    renderScreen(<PasskeyHelpScreen name="Sari" onDone={onDone} onUsePassword={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Welcome, Sari' })).toBeInTheDocument();
    press(FACE);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    // The device is named from the browser; Devices renames it.
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({ stage: 'full', deviceName: 'Computer' });
    expect(getCredentialId('staff')).toBeTruthy();
    expect(getCredentialId('admin')).toBeNull();
    const me = await fetchMe();
    expect(me.ok && me.data.me.stage).toBe('full');
  });

  it('says just "Welcome" when the invite has no name', () => {
    renderScreen(<PasskeyHelpScreen onDone={vi.fn()} onUsePassword={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });

  it('says so under the cards when the prompt is closed or fails, and can be tried again', async () => {
    await startSetup();
    const onDone = vi.fn();
    renderScreen(<PasskeyHelpScreen onDone={onDone} onUsePassword={vi.fn()} />);
    browserPasskeys.failNext('cancel');
    press(FACE);
    expect(
      await screen.findByText('The passkey prompt was closed. Try again, or use a password.'),
    ).toBeInTheDocument();
    browserPasskeys.failNext('fail');
    press(FACE);
    expect(
      await screen.findByText('This device could not use a passkey. Try again, or use a password.'),
    ).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    press(FACE);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('offers only the password on an IP-address web address (D-046)', () => {
    vi.stubGlobal('location', { ...window.location, hostname: '192.168.1.20' });
    const onUsePassword = vi.fn();
    renderScreen(<PasskeyHelpScreen onDone={vi.fn()} onUsePassword={onUsePassword} />);
    expect(screen.queryByRole('button', { name: FACE })).not.toBeInTheDocument();
    expect(screen.getByText(/does not work on this web address/)).toBeInTheDocument();
    press(SET_PASSWORD);
    expect(onUsePassword).toHaveBeenCalled();
  });

  it('offers only the password where the browser has no WebAuthn', () => {
    browserPasskeys.setSupported(false);
    renderScreen(<PasskeyHelpScreen onDone={vi.fn()} onUsePassword={vi.fn()} />);
    expect(screen.queryByRole('button', { name: FACE })).not.toBeInTheDocument();
  });

  it('says so when the setup has timed out', async () => {
    renderScreen(<PasskeyHelpScreen onDone={vi.fn()} onUsePassword={vi.fn()} />);
    press(FACE);
    expect(
      await screen.findByText('Your setup timed out. Start again with a new key.'),
    ).toBeInTheDocument();
  });
});

describe('PasswordSetupScreen', () => {
  it('checks length and match, shows and hides, then saves', async () => {
    await startSetup();
    const onDone = vi.fn();
    renderScreen(<PasswordSetupScreen onDone={onDone} />);
    type('New password', 'short');
    press('Save password');
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();

    type('New password', PASSWORD);
    type('Confirm password', 'something else entirely');
    press('Save password');
    expect(screen.getByText('The two passwords are not the same.')).toBeInTheDocument();

    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password');
    press('Show: New password');
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
    press('Hide: New password');
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password');

    type('Confirm password', PASSWORD);
    press('Save password');
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({ role: 'seller', stage: 'full' });
    expect(getCredentialId('staff')).toBeNull();
  });

  it('tells the person a passkey can come later', () => {
    renderScreen(<PasswordSetupScreen onDone={vi.fn()} />);
    expect(
      screen.getByText('You can switch to face or fingerprint later from a newer device.'),
    ).toBeInTheDocument();
  });
});

describe('SignInScreen', () => {
  it('signs in with the passkey this device kept', async () => {
    await signInAsSeller('passkey');
    await signOut();
    const onSignedIn = vi.fn();
    renderScreen(
      <SignInScreen slug="dapur-demo" kitchenName="Dapur Demo" onSignedIn={onSignedIn} />,
    );
    expect(screen.getByText('Lost access? Ask the owner for a new invite.')).toBeInTheDocument();
    press('Sign in with face or fingerprint');
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(sessionCookie()).toBeTruthy();
  });

  it('switch person: signs out, then opens the passkey picker at once, wiping nothing else', async () => {
    await signInAsSeller('passkey');
    const keep = () =>
      JSON.stringify(
        Object.entries(localStorage)
          .filter(([key]) => key !== 'signedIn')
          .sort(),
      );
    const kept = keep();
    expect(getCredentialId('staff')).not.toBeNull();
    await signOut(); // what the Switch person button does first
    expect(sessionCookie()).toBeNull();
    expect(keep()).toBe(kept); // only the signed-in hint goes: device, passkey and kitchen stay
    const get = vi.spyOn(browserPasskeys.authenticator, 'get');
    const onSignedIn = vi.fn();
    renderScreen(<SignInScreen slug="dapur-demo" switchPerson onSignedIn={onSignedIn} />);
    // No button was pressed: the prompt opened by itself, listing every passkey (discoverable).
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(get).toHaveBeenCalledTimes(1);
    const options = get.mock.calls[0]?.[0] as { allowCredentials?: Array<unknown> };
    expect(options.allowCredentials ?? []).toHaveLength(0);
    expect(sessionCookie()).toBeTruthy();
  });

  it('switch person: a closed prompt opens the password step, and Back returns to the passkey', async () => {
    await signInAsSeller('passkey');
    await signOut();
    browserPasskeys.failNext('cancel');
    renderScreen(
      <SignInScreen
        slug="dapur-demo"
        switchPerson
        onSignedIn={vi.fn()}
        footer={<a href="/seller/setup">First time on this device? Use your invite key</a>}
      />,
    );
    // The message sits under the password field, in words.
    expect(await screen.findByText(/The passkey prompt was closed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    press('Back');
    expect(screen.getByText('First time on this device? Use your invite key')).toBeInTheDocument();
    expect(screen.getByText('Lost access? Ask the owner for a new invite.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in with face or fingerprint' })).toBeEnabled();
    expect(screen.queryByText(/The passkey prompt was closed/)).not.toBeInTheDocument();
  });

  it('opens the password box when the browser has no passkey to offer', async () => {
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={vi.fn()} />);
    press('Sign in with face or fingerprint');
    expect(await screen.findByText(/The passkey prompt was closed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('signs in with nothing stored (discoverable), and refuses the admin passkey here', async () => {
    await signInAsSeller('passkey');
    await signOut();
    localStorage.clear();
    const onSignedIn = vi.fn();
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={onSignedIn} />);
    press('Sign in with face or fingerprint');
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    await signOut();

    // An admin passkey made after the seller's one is the browser's newest: picking it here is refused.
    await adminPasskeyOnThisBrowser();
    await signOut();
    localStorage.removeItem('passkeyCredential.staff'); // no hint: the browser offers all, newest first
    onSignedIn.mockClear();
    press('Sign in with face or fingerprint');
    expect(await screen.findByText(/belongs to the admin/)).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(sessionCookie()).toBeNull();
    expect(getCredentialId('admin')).not.toBeNull();
  });

  it('hides the passkey button on an IP-address web address and shows the password', () => {
    vi.stubGlobal('location', { ...window.location, hostname: '192.168.1.20' });
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={vi.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Sign in with face or fingerprint' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/does not work on this web address/)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('says so when the passkey prompt is closed', async () => {
    await signInAsSeller('passkey');
    await signOut();
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={vi.fn()} />);
    browserPasskeys.failNext('cancel');
    press('Sign in with face or fingerprint');
    expect(
      await screen.findByText('The passkey prompt was closed. Try again, or use a password.'),
    ).toBeInTheDocument();
  });

  it('signs in with a password, and counts wrong tries', async () => {
    await signInAsSeller('password');
    clearCookies();
    const onSignedIn = vi.fn();
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={onSignedIn} />);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    press('Use password instead');
    type('Password', 'not the password');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('That did not work. Check it and try again. 4 tries left.'),
    ).toBeInTheDocument();
    type('Password', PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(onSignedIn.mock.calls[0]?.[0]).toMatchObject({ role: 'seller', stage: 'full' });
  });

  it('locks after five wrong passwords', async () => {
    await signInAsSeller('password');
    clearCookies();
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={vi.fn()} />);
    press('Use password instead');
    type('Password', 'nope nope nope');
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
      await waitFor(() =>
        expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true'),
      );
      if (i < 4)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());
    }
    expect(await screen.findByText('Too many tries. Try again in 15 minutes.')).toBeInTheDocument();
  });
});

describe('DevicesScreen', () => {
  async function otherDevice(name: string) {
    const added = await mockStores.auth.signInPassword({
      deviceId: 'other-device-1',
      slug: 'dapur-demo',
      password: PASSWORD,
      deviceName: name,
    });
    if (!added.ok) throw new Error(added.error);
  }

  it('lists this device and the others, renames this device', async () => {
    await signInAsSeller('password', 'Phone A');
    await otherDevice('Laptop B');
    renderScreen(<DevicesScreen onSignedOut={vi.fn()} />);
    expect(await screen.findByText('Phone A')).toBeInTheDocument();
    expect(screen.getByText('Laptop B')).toBeInTheDocument();
    expect(screen.getByText('Active now')).toBeInTheDocument();
    expect(screen.getByText(/^Last used /)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0] as HTMLElement);
    const field = screen.getByLabelText(/^New name for /);
    fireEvent.change(field, { target: { value: 'Phone A (kitchen)' } });
    press('Save name');
    expect(await screen.findByText('Phone A (kitchen)')).toBeInTheDocument();
    const me = await fetchMe();
    expect(me.ok && me.data.me.deviceName).toBe('Phone A (kitchen)');
  });

  it('signs another device out on the second tap', async () => {
    await signInAsSeller('password', 'Phone A');
    await otherDevice('Laptop B');
    renderScreen(<DevicesScreen onSignedOut={vi.fn()} />);
    await screen.findByText('Laptop B');
    press('Sign out');
    expect(screen.getByText('Laptop B')).toBeInTheDocument();
    press('Tap again to sign out');
    await waitFor(() => expect(screen.queryByText('Laptop B')).not.toBeInTheDocument());
    expect(screen.getByText('No other devices yet.')).toBeInTheDocument();
  });

  it('signs this device out on the second tap', async () => {
    await signInAsSeller('password');
    const onSignedOut = vi.fn();
    renderScreen(<DevicesScreen onSignedOut={onSignedOut} />);
    await screen.findByText('Active now');
    press('Sign out of this device');
    expect(onSignedOut).not.toHaveBeenCalled();
    press('Tap again to sign out');
    await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1));
    expect(sessionCookie()).toBeNull();
  });

  it('shows an add-device code with a countdown that ends', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: MOCK_NOW });
    await signInAsSeller('password');
    renderScreen(<DevicesScreen onSignedOut={vi.fn()} />);
    await screen.findByText('Active now');
    press('Add a device');
    const code = await screen.findByLabelText('Your code');
    expect(code.textContent).toMatch(/^\d{6}$/);
    expect(screen.getByText('Expires in 10:00')).toBeInTheDocument();

    // The code works for a new device while it is alive.
    const redeemed = await mockStores.auth.redeemCode(code.textContent ?? '', 'new-device-1');
    expect(redeemed.ok).toBe(true);

    vi.setSystemTime(new Date(MOCK_NOW.getTime() + 4 * 60_000));
    expect(await screen.findByText('Expires in 06:00', {}, { timeout: 3000 })).toBeInTheDocument();
    vi.setSystemTime(new Date(MOCK_NOW.getTime() + 11 * 60_000));
    expect(
      await screen.findByText('This code has expired.', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make a new code' })).toBeInTheDocument();
  });

  it('says so when the list cannot be loaded', async () => {
    renderScreen(<DevicesScreen onSignedOut={vi.fn()} />);
    expect(await screen.findByText('Could not load your devices.')).toBeInTheDocument();
  });
});

describe('Indonesian', () => {
  it('speaks Indonesian on the key, password and passkey screens', async () => {
    await i18n.changeLanguage('id');
    const view = renderScreen(<SetupKeyScreen onSession={vi.fn()} onUseCode={vi.fn()} />);
    expect(screen.getByText('Kunci undangan dari pemilik dapur')).toBeInTheDocument();
    press('Lanjut');
    expect(screen.getByText('Ketik kunci yang kamu terima.')).toBeInTheDocument();
    view.unmount();

    renderScreen(<PasswordSetupScreen onDone={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Atur kata sandi' })).toBeInTheDocument();
    press('Simpan kata sandi');
    expect(screen.getByText('Pakai minimal 10 karakter.')).toBeInTheDocument();
  });

  it('says the lockout in minutes in Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderScreen(<SetupKeyScreen onSession={vi.fn()} onUseCode={vi.fn()} />);
    type('Kunci undangan dari pemilik dapur', 'salah');
    for (let i = 0; i < 5; i++) {
      press('Lanjut');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Lanjut' })).toBeEnabled());
    }
    expect(
      await screen.findByText('Terlalu banyak percobaan. Coba lagi dalam 15 menit.'),
    ).toBeInTheDocument();
  });

  it('shows the Create cards and the sign-in in Indonesian', async () => {
    await i18n.changeLanguage('id');
    const view = renderScreen(
      <PasskeyHelpScreen name="Sari" onDone={vi.fn()} onUsePassword={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { name: 'Selamat datang, Sari' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Wajah atau sidik jari/ })).toBeInTheDocument();
    view.unmount();
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Masuk dengan wajah atau sidik jari' }),
    ).toBeInTheDocument();
  });
});

describe('ordering while signed in as a seller', () => {
  it('a signed-in Onde Onde seller orders at Dapur Demo as a plain customer', async () => {
    // Signed in as Onde Onde's seller, with a session cookie on every request.
    const made = await mockStores.auth.createKey(
      { role: 'seller', sellerId: await sellerId('onde-onde') },
      'invite',
    );
    const started = await signInWithKey(made.key);
    if (!started.ok) throw new Error(started.error);
    const done = await registerDevice({
      kind: 'password',
      password: PASSWORD,
      deviceName: 'Rina tablet',
    });
    if (!done.ok) throw new Error(done.error);
    expect(sessionCookie()).toBeTruthy();

    const dapur = await mockStores.sellerBySlug('dapur-demo');
    const ondeBefore = JSON.stringify(await fetchSellerOrders());
    const dapurBefore = (await dapur?.listOrders())?.length ?? 0;

    const menu = await fetchMenu('dapur-demo');
    if (!menu.ok) throw new Error(menu.error);
    const item = menu.data.items.find((candidate) => !candidate.soldOut);
    if (!item) throw new Error('Dapur Demo has no item to order');
    const placed = await placeOrder('dapur-demo', {
      firstName: 'Ayu',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: item.id, qty: 1 }],
    });
    if (!placed.ok) throw new Error(placed.error);
    expect(placed.data.order.seller.slug).toBe('dapur-demo');

    // It shows in that customer's My orders.
    const mine = await fetchMyOrders([placed.data.order.token]);
    expect(mine.ok && mine.data.orders.map((order) => order.code)).toEqual([
      placed.data.order.code,
    ]);

    // It is a normal customer order in Dapur Demo's list: no staff identity.
    const theirs = (await dapur?.listOrders()) ?? [];
    expect(theirs).toHaveLength(dapurBefore + 1);
    const stored = theirs.find((order) => order.code === placed.data.order.code);
    expect(stored).toBeDefined();
    expect(stored?.enteredBy).toBeUndefined();
    // Its audit says the customer made it, like any other customer order: no seller or chef.
    expect(stored?.audit.map((entry) => [entry.what, entry.by])).toEqual([
      ['created', { name: 'Ayu', role: 'customer' }],
    ]);
    expect(stored?.firstName).toBe('Ayu');

    // Onde Onde's own orders are unchanged.
    expect(JSON.stringify(await fetchSellerOrders())).toBe(ondeBefore);
  });
});
