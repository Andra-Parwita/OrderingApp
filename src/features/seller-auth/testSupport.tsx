import { render } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { mockStores } from '../../../mocks/handlers';
import { registerDevice, signInWithKey, signOut } from '../../api/auth';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerAuthI18n } from './i18n/register';

/** Test-only helpers shared by this feature's tests. */

export const PASSWORD = 'long enough password';

export async function setupI18n(): Promise<void> {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerSellerAuthI18n();
  await i18n.changeLanguage('en');
}

export function renderScreen(ui: ReactNode) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

export async function sellerId(slug = 'dapur-demo'): Promise<string> {
  const seller = (await mockStores.listSellers()).find((candidate) => candidate.slug === slug);
  if (!seller) throw new Error(`no seller ${slug}`);
  return seller.id;
}

/** A fresh invite key for Dapur Demo, made straight in the repository (no admin session needed). */
export async function inviteKey(): Promise<string> {
  const made = await mockStores.auth.createKey(
    { role: 'seller', sellerId: await sellerId() },
    'invite',
  );
  return made.key;
}

/** This browser becomes a signed-in Dapur Demo seller device (password or simulated passkey). */
export async function signInAsSeller(
  how: 'password' | 'passkey',
  deviceName = 'Test phone',
): Promise<void> {
  const started = await signInWithKey(await inviteKey());
  if (!started.ok) throw new Error(started.error);
  const done = await registerDevice(
    how === 'password'
      ? { kind: 'password', password: PASSWORD, deviceName }
      : { kind: 'passkey', deviceName },
  );
  if (!done.ok) throw new Error(done.error);
}

/** Starts a setup session from a fresh key (what the register screens expect to find). */
export async function startSetup(): Promise<void> {
  const started = await signInWithKey(await inviteKey());
  if (!started.ok) throw new Error(started.error);
}

export { signOut };
