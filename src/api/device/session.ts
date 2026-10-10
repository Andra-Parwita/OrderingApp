// What this browser keeps for sign-in: a random id the server counts lockouts on, and the
// credential id of this device's passkey (public data; the key itself stays in the platform).
// The session is NOT kept here: since stage 8.2 it is an HttpOnly `__Host-session` cookie that
// scripts cannot read.
const LEGACY_TOKEN_KEY = 'session';
const DEVICE_KEY = 'deviceId';
const CREDENTIAL_KEY = 'passkeyCredential';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the value just does not stick
  }
}

/** Deletes the session token an older version left in localStorage (it is no longer used). */
export const dropLegacySessionToken = (): void => write(LEGACY_TOKEN_KEY, null);

// The cookie is invisible to scripts, so this device keeps a plain hint that a sign-in happened
// (nothing secret: "1"). It only saves a pointless `/api/auth/me` call, and the sign-in screen
// for a device that never signed in. The server always has the last word: a 401 clears the hint.
const HINT_KEY = 'signedIn';
export const hasSessionHint = (): boolean => read(HINT_KEY) === '1';
export const setSessionHint = (on: boolean): void => write(HINT_KEY, on ? '1' : null);

// One passkey id hint per kind of account: this browser can hold an admin passkey and a seller or
// chef passkey side by side, and one must never overwrite the other. A hint only narrows the
// browser's list (`allowCredentials`); sign-in works without it (discoverable passkey).
export type CredentialRole = 'admin' | 'staff';
const keyOf = (role: CredentialRole): string => `${CREDENTIAL_KEY}.${role}`;

/** The single id an older version kept for the whole site: read once as a staff hint, then removed. */
function migrateLegacyCredential(): void {
  const legacy = read(CREDENTIAL_KEY);
  if (legacy === null) return;
  if (read(keyOf('staff')) === null) write(keyOf('staff'), legacy);
  write(CREDENTIAL_KEY, null);
}

export const getCredentialId = (role: CredentialRole): string | null => {
  migrateLegacyCredential();
  return read(keyOf(role));
};
export const setCredentialId = (role: CredentialRole, id: string): void => write(keyOf(role), id);
export const clearCredentialId = (role: CredentialRole): void => write(keyOf(role), null);

let memoryId: string | undefined;

/** A random id for this browser, made once (8 to 64 characters, the contract's shape). */
export function getDeviceId(): string {
  const stored = read(DEVICE_KEY);
  if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
  memoryId ??= `d-${crypto.randomUUID()}`;
  write(DEVICE_KEY, memoryId);
  return memoryId;
}
