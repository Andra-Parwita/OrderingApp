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

export const getCredentialId = (): string | null => read(CREDENTIAL_KEY);
export const setCredentialId = (id: string): void => write(CREDENTIAL_KEY, id);
export const clearCredentialId = (): void => write(CREDENTIAL_KEY, null);

let memoryId: string | undefined;

/** A random id for this browser, made once (8 to 64 characters, the contract's shape). */
export function getDeviceId(): string {
  const stored = read(DEVICE_KEY);
  if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
  memoryId ??= `d-${crypto.randomUUID()}`;
  write(DEVICE_KEY, memoryId);
  return memoryId;
}
