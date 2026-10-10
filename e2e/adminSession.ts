import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SoftAuthenticator, type ExportedCredential } from '../mocks/softAuthenticator';
import { addCredential } from './virtualAuthenticator';

// The dev admin made once per run by global-setup.ts: one real passkey per label (ES256 key pairs
// made by a software authenticator, registered through the real /api/auth endpoints), so specs do
// not sign each other out. A label is used either by a browser (the key is loaded into Chrome's
// virtual authenticator) or over the API (the software authenticator signs in), never both.

// The admin setup key scripts/scratch-server.mjs gives the e2e server as its ADMIN_SETUP_KEY.
export const DEV_ADMIN_SETUP_KEY = 'DLV-DEVA-DMIN-SETU-PKEY';
export const ADMIN_FILE = 'test-results/e2e-admin.json';
export const ADMIN_LABELS = [
  'seller-auth-mobile-chromium',
  'seller-auth-desktop-chromium',
  'admin-desktop-chromium',
  'session-flow-desktop-chromium',
] as const;
export type AdminLabel = (typeof ADMIN_LABELS)[number];

/** The site the specs run against; state-changing API calls must send it as `Origin`. */
export const ORIGIN = `https://localhost:${process.env['PORT'] ?? '5181'}`;
export const originHeaders = { Origin: ORIGIN };

/**
 * A signature counter that only ever goes up between processes and runs: 10 steps per second
 * since 2026-10-01 (CDP takes a signed 32-bit count: this lasts about 6 years). Chrome's virtual authenticator adds one per sign-in, the software one
 * takes the value as it is; the server refuses a counter that does not go up.
 */
const COUNTER_ZERO = Date.UTC(2026, 9, 1) / 1000;
let lastCounter = 0;
export function nextCounter(): number {
  lastCounter = Math.max(lastCounter + 1, Math.floor(Date.now() / 1000 - COUNTER_ZERO) * 10);
  return lastCounter;
}
/** The counter to hand Chrome's virtual authenticator for a credential it is about to hold. */
export const startCounter = (): number => nextCounter();

export function adminCredential(label: AdminLabel): ExportedCredential {
  const all = JSON.parse(readFileSync(ADMIN_FILE, 'utf8')) as Record<string, ExportedCredential>;
  const credential = all[label];
  if (!credential) throw new Error(`No admin passkey for ${label}`);
  return credential;
}

/**
 * Signs the admin device in over the API with its software passkey: the real challenge, signature
 * and counter checks run on the server. The session cookie lands in `request`'s cookie jar.
 */
export async function adminSignIn(request: APIRequestContext, label: AdminLabel): Promise<void> {
  const credential = adminCredential(label);
  const soft = SoftAuthenticator.from(ORIGIN, [credential]);
  const deviceId = `e2e-${label}`;
  const asked = await request.post('/api/auth/passkey/options', {
    data: {
      deviceId,
      credentialId: Buffer.from(credential.credentialId, 'base64').toString('base64url'),
    },
  });
  expect(asked.ok()).toBe(true);
  const { options } = (await asked.json()) as { options: { challenge: string } };
  const response = soft.get(options, { counter: nextCounter() });
  const signedIn = await request.post('/api/auth/passkey', {
    data: { deviceId, response },
  });
  expect(signedIn.ok()).toBe(true);
}

/**
 * Lets the browser page act as that admin device: Chrome's virtual authenticator holds its passkey
 * (as after a real setup), and the page remembers the credential id like a real sign-in does.
 */
export async function keepAdminPasskey(page: Page, label: AdminLabel): Promise<void> {
  const credential = adminCredential(label);
  await addCredential(page, credential, startCounter());
  const credentialId = Buffer.from(credential.credentialId, 'base64').toString('base64url');
  await page.addInitScript(
    (id) => localStorage.setItem('passkeyCredential.admin', id),
    credentialId,
  );
}
