import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../../mocks/browserPasskeys';
import { clearCookies, installCookieJar, sessionCookie } from '../../../mocks/cookieJar';
import { MOCK_NOW, mockStores } from '../../../mocks/handlers';
import { createDeviceCode, fetchMe } from '../../api/auth';
import { getCredentialId } from '../../api/device/session';
import { cleanCode, cleanKey, guessDevice } from './authText';
import { DevicesScreen } from './DevicesScreen';
import { PasskeyHelpScreen } from './PasskeyHelpScreen';
import { PasswordSetupScreen } from './PasswordSetupScreen';
import { DeviceCodeScreen, SetupKeyScreen } from './SetupKeyScreen';
import { SignInScreen } from './SignInScreen';
import {
  PASSWORD,
  inviteKey,
  renderScreen,
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
    type('Enter the key you were sent', key.toLowerCase().replaceAll('-', '  '));
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
    type('Enter the key you were sent', 'wrong key');
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

  it('switches to the code screen', () => {
    const onUseCode = vi.fn();
    renderScreen(<SetupKeyScreen onSession={vi.fn()} onUseCode={onUseCode} />);
    press('I have a 6-digit code from another device');
    expect(onUseCode).toHaveBeenCalled();
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
    type('6-digit code', `${code.data.code.slice(0, 3)} ${code.data.code.slice(3)}`);
    press('Continue');
    await waitFor(() => expect(onSession).toHaveBeenCalledTimes(1));
    expect(onSession.mock.calls[0]?.[0]).toMatchObject({ role: 'seller', stage: 'setup' });
  });

  it('refuses a short or wrong code in plain words', async () => {
    renderScreen(<DeviceCodeScreen onSession={vi.fn()} onUseKey={vi.fn()} />);
    type('6-digit code', '12');
    press('Continue');
    expect(screen.getByText('Type the 6-digit code.')).toBeInTheDocument();
    type('6-digit code', '000000');
    press('Continue');
    expect(
      await screen.findByText('That did not work. Check it and try again. 4 tries left.'),
    ).toBeInTheDocument();
  });
});

describe('PasskeyHelpScreen', () => {
  it('shows steps per device and creates a real passkey', async () => {
    await startSetup();
    const onDone = vi.fn();
    renderScreen(<PasskeyHelpScreen name="Dapur Demo" onDone={onDone} onUsePassword={vi.fn()} />);
    expect(screen.getByText('Hi Dapur Demo')).toBeInTheDocument();
    expect(screen.queryByText(/simulated/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name of this device')).toHaveValue('Computer');

    fireEvent.click(screen.getByRole('radio', { name: 'iPhone' }));
    expect(screen.getByText('Confirm with Face ID or your passcode')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Android' }));
    expect(screen.getByText('Confirm with your fingerprint or screen PIN')).toBeInTheDocument();

    type('Name of this device', 'Bu Ani phone');
    press('Create passkey');
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({ stage: 'full', deviceName: 'Bu Ani phone' });
    expect(getCredentialId()).toBeTruthy();
    const me = await fetchMe();
    expect(me.ok && me.data.me.stage).toBe('full');
  });

  it('says so when the passkey prompt is closed or fails, and can be tried again', async () => {
    await startSetup();
    const onDone = vi.fn();
    renderScreen(<PasskeyHelpScreen onDone={onDone} onUsePassword={vi.fn()} />);
    browserPasskeys.failNext('cancel');
    press('Create passkey');
    expect(
      await screen.findByText('The passkey prompt was closed. Try again, or use a password.'),
    ).toBeInTheDocument();
    browserPasskeys.failNext('fail');
    press('Create passkey');
    expect(
      await screen.findByText('This device could not use a passkey. Try again, or use a password.'),
    ).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    press('Create passkey');
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('offers only the password on an IP-address web address (D-046)', () => {
    vi.stubGlobal('location', { ...window.location, hostname: '192.168.1.20' });
    const onUsePassword = vi.fn();
    renderScreen(<PasskeyHelpScreen onDone={vi.fn()} onUsePassword={onUsePassword} />);
    expect(screen.queryByRole('button', { name: 'Create passkey' })).not.toBeInTheDocument();
    expect(screen.getByText(/Passkeys do not work on this web address/)).toBeInTheDocument();
    press('Set a password');
    expect(onUsePassword).toHaveBeenCalled();
  });

  it('offers only the password where the browser has no WebAuthn', () => {
    browserPasskeys.setSupported(false);
    renderScreen(<PasskeyHelpScreen onDone={vi.fn()} onUsePassword={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Create passkey' })).not.toBeInTheDocument();
  });

  it('needs a device name, and offers the password way out', async () => {
    await startSetup();
    const onUsePassword = vi.fn();
    renderScreen(<PasskeyHelpScreen onDone={vi.fn()} onUsePassword={onUsePassword} />);
    type('Name of this device', '  ');
    press('Create passkey');
    expect(screen.getByText('Write a name for this device.')).toBeInTheDocument();
    press("My phone can't do this → set a password instead");
    expect(onUsePassword).toHaveBeenCalled();
  });

  it('says so when the setup has timed out', async () => {
    renderScreen(<PasskeyHelpScreen onDone={vi.fn()} onUsePassword={vi.fn()} />);
    press('Create passkey');
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
    expect(getCredentialId()).toBeNull();
  });

  it('tells the person a passkey can come later', () => {
    renderScreen(<PasswordSetupScreen onDone={vi.fn()} />);
    expect(
      screen.getByText('You can switch to a passkey later from a newer device.'),
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
    expect(
      screen.getByText('Lost access? Ask the person who set you up for a new key'),
    ).toBeInTheDocument();
    press('Sign in with passkey');
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(sessionCookie()).toBeTruthy();
  });

  it('opens the password box when there is no passkey on this device', () => {
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={vi.fn()} />);
    press('Sign in with passkey');
    expect(screen.getByText(/has no passkey yet/)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('hides the passkey button on an IP-address web address and shows the password', () => {
    vi.stubGlobal('location', { ...window.location, hostname: '192.168.1.20' });
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Sign in with passkey' })).not.toBeInTheDocument();
    expect(screen.getByText(/Passkeys do not work on this web address/)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('says so when the passkey prompt is closed', async () => {
    await signInAsSeller('passkey');
    await signOut();
    renderScreen(<SignInScreen slug="dapur-demo" onSignedIn={vi.fn()} />);
    browserPasskeys.failNext('cancel');
    press('Sign in with passkey');
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
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
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
    expect(screen.getByText('Masukkan kunci yang kamu terima')).toBeInTheDocument();
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
    type('Masukkan kunci yang kamu terima', 'salah');
    for (let i = 0; i < 5; i++) {
      press('Lanjut');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Lanjut' })).toBeEnabled());
    }
    expect(
      await screen.findByText('Terlalu banyak percobaan. Coba lagi dalam 15 menit.'),
    ).toBeInTheDocument();
  });

  it('shows the passkey steps in Indonesian', () => {
    return i18n.changeLanguage('id').then(() => {
      renderScreen(<PasskeyHelpScreen onDone={vi.fn()} onUsePassword={vi.fn()} />);
      expect(screen.getByRole('heading', { name: 'Buat passkey' })).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });
  });
});
