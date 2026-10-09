import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The dev admin made once per run by global-setup.ts: one passkey per label, so specs do not
// sign each other out.

// The dev mock's admin setup key (worker/mock/auth.ts).
export const DEV_ADMIN_SETUP_KEY = 'DLV-DEVA-DMIN-SETU-PKEY';
export const ADMIN_FILE = 'test-results/e2e-admin.json';
export const ADMIN_LABELS = [
  'seller-auth-mobile-chromium',
  'seller-auth-desktop-chromium',
  'admin-desktop-chromium',
  'session-flow-desktop-chromium',
] as const;
export type AdminLabel = (typeof ADMIN_LABELS)[number];

export function adminCredential(label: AdminLabel): string {
  const all = JSON.parse(readFileSync(ADMIN_FILE, 'utf8')) as Record<string, string>;
  const credentialId = all[label];
  if (!credentialId) throw new Error(`No admin passkey for ${label}`);
  return credentialId;
}

/** Signs the admin device in over the API and returns the session token. */
export async function adminToken(request: APIRequestContext, label: AdminLabel): Promise<string> {
  const signedIn = await request.post('/api/auth/passkey', {
    data: { credentialId: adminCredential(label), deviceId: `e2e-${label}` },
  });
  expect(signedIn.ok()).toBe(true);
  return ((await signedIn.json()) as { token: string }).token;
}

/** Lets the browser page act as that admin device (its passkey, as after a real setup). */
export async function keepAdminPasskey(page: Page, label: AdminLabel): Promise<void> {
  const credentialId = adminCredential(label);
  await page.addInitScript((id) => localStorage.setItem('passkeyCredential', id), credentialId);
}
