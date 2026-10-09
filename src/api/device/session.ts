// What this browser keeps for sign-in (dev mock, stage 7.1): the session token, a random device
// id the server counts lockouts on, and the simulated passkey's credential id. Phase 4 keeps the
// token in an HttpOnly cookie instead and the passkey in the platform.
const TOKEN_KEY = 'session';
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

export const getSessionToken = (): string | null => read(TOKEN_KEY);
export const setSessionToken = (token: string): void => write(TOKEN_KEY, token);
export const clearSessionToken = (): void => write(TOKEN_KEY, null);

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
