import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../../mocks/browserPasskeys';
import { clearCookies, installCookieJar } from '../../../mocks/cookieJar';
import { mockStores } from '../../../mocks/handlers';
import { setMyPassword } from '../../api/auth';
import { DevicesScreen } from './DevicesScreen';
import {
  PASSWORD,
  renderScreen,
  sellerId,
  setupI18n,
  signInAsSeller,
  startSetup,
} from './testSupport';

// Plan 128: a signed-in person adds or changes their own backup password in Settings -> Devices.

vi.mock(
  '@simplewebauthn/browser',
  async () => (await import('../../../mocks/browserPasskeys')).browserMock,
);

let restoreFetch: () => void;
beforeAll(async () => {
  restoreFetch = installCookieJar();
  await setupI18n();
});
afterAll(() => restoreFetch());
beforeEach(async () => {
  await mockStores.reset();
  localStorage.clear();
  clearCookies();
  browserPasskeys.reset();
});

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** Whether this person can sign in to the kitchen with `password` (a new device each time). */
async function canSignInWith(password: string): Promise<boolean> {
  const [person] = await mockStores.auth.teamNames(await sellerId());
  const result = await mockStores.auth.signInPassword({
    deviceId: `check-${password.length}-${Math.random().toString(36).slice(2, 8)}`,
    slug: 'dapur-demo',
    accountId: person?.accountId ?? '',
    password,
    deviceName: 'Check',
  });
  return result.ok;
}

describe('Backup password on Devices', () => {
  it('says "Not set" for a screen-lock person, adds a password and then it signs in', async () => {
    await signInAsSeller('passkey', 'Tablet');
    renderScreen(<DevicesScreen onSignedOut={vi.fn()} />);
    expect(await screen.findByText('Password · Not set')).toBeInTheDocument();
    expect(
      screen.getByText("Add a password you can use if your screen lock doesn't work."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const layer = await screen.findByRole('dialog', { name: 'Backup password' });
    type('New password', 'long enough');
    type('Confirm password', 'long enough');
    fireEvent.click(within(layer).getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('Saved. Write it down somewhere safe.')).toBeInTheDocument();
    expect(await screen.findByText('Password · Set')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(await canSignInWith('long enough')).toBe(true);
  });

  it('changes an existing password without asking for the old one', async () => {
    await signInAsSeller('password', 'Phone');
    renderScreen(<DevicesScreen onSignedOut={vi.fn()} />);
    expect(await screen.findByText('Password · Set')).toBeInTheDocument();
    expect(screen.getByText("On the sign-in screen tap 'Use password instead'.")).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.queryByLabelText(/current|old/i)).not.toBeInTheDocument();
    type('New password', 'brand new one');
    type('Confirm password', 'brand new one');
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    await screen.findByText('Saved. Write it down somewhere safe.');
    expect(await canSignInWith('brand new one')).toBe(true);
    expect(await canSignInWith(PASSWORD)).toBe(false);
  });

  it('refuses a short password and two that do not match, and sends nothing', async () => {
    await signInAsSeller('passkey', 'Tablet');
    renderScreen(<DevicesScreen onSignedOut={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
    type('New password', 'short');
    type('Confirm password', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    type('New password', '12345678');
    type('Confirm password', '1234567x');
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('The two passwords are not the same.')).toBeInTheDocument();
    expect(await canSignInWith('12345678')).toBe(false);
    expect(screen.queryByText('Saved. Write it down somewhere safe.')).not.toBeInTheDocument();
  });

  it('Show reveals the typed password, and Cancel closes the form without saving', async () => {
    await signInAsSeller('passkey', 'Tablet');
    renderScreen(<DevicesScreen onSignedOut={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
    type('New password', 'abcdefgh');
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: /^Show: New password/ }));
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Password · Not set')).toBeInTheDocument();
  });

  it('is refused for a setup session (no full sign-in yet)', async () => {
    await startSetup();
    const result = await setMyPassword('long enough');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.status).toBe(401);
  });
});
