// Sign-in, devices and admin calls (stage 7.1, real passkeys in 8.2). A call that returns a session
// sets the HttpOnly session cookie (the browser keeps and sends it; scripts never see it). Passkeys
// are WebAuthn: the server makes options, the browser's own prompt signs, the server checks.
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import {
  parseChefAccessResponse,
  parseCodeResponse,
  parseDevicesResponse,
  parseKeyResponse,
  parseMeResponse,
  parsePasskeyOptionsResponse,
  parseSellerResponse,
  passkeysAvailable,
  parseSellersResponse,
  parseSessionResponse,
  type ChefAccessResponse,
  type CodeResponse,
  type DevicesResponse,
  type KeyResponse,
  type MeResponse,
  type SellerResponse,
  type SellersResponse,
  type SessionResponse,
} from '../../shared/authContract';
import { parseOkResponse, type OkResponse } from '../../shared/setupContract';
import {
  clearCredentialId,
  getCredentialId,
  getDeviceId,
  setCredentialId,
  setSessionHint,
} from './device/session';
import { request, type ApiResult } from './http';

const enc = encodeURIComponent;

/** The credential id of a new passkey is kept (public data) to ask for sign-in options later. */
async function keepSession(
  call: Promise<ApiResult<SessionResponse>>,
): Promise<ApiResult<SessionResponse>> {
  const result = await call;
  if (result.ok) {
    setSessionHint(true);
    if (result.data.credentialId) setCredentialId(result.data.credentialId);
  }
  return result;
}

/**
 * Whether this page can use passkeys: a real domain name (or localhost), not an IP address, in a
 * browser that has WebAuthn. On the home Wi-Fi IP address of a phone test it is false, and the
 * sign-in screens offer the password only (D-046).
 */
export function passkeysSupported(): boolean {
  return passkeysAvailable(location.hostname) && browserSupportsWebAuthn();
}

/** Runs the browser's passkey prompt; a closed prompt and a real failure are told apart. */
async function ceremony<T>(run: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : '';
    const cancelled = name === 'NotAllowedError' || name === 'AbortError';
    return {
      ok: false,
      error: cancelled ? 'passkey_cancelled' : 'passkey_failed',
      status: 0,
      message: cause instanceof Error ? cause.message : 'Passkey failed',
    };
  }
}

const post = (path: string, body: unknown) =>
  keepSession(request(path, parseSessionResponse, { method: 'POST', body }));

/** Seller or chef: an invite or recovery key starts setup (a short session). */
export function signInWithKey(key: string): Promise<ApiResult<SessionResponse>> {
  return post('/api/auth/invite', { key, deviceId: getDeviceId() });
}

/** The 6-digit add-device code from another signed-in device starts setup on this one. */
export function signInWithCode(code: string): Promise<ApiResult<SessionResponse>> {
  return post('/api/auth/code', { code, deviceId: getDeviceId() });
}

export type RegisterInput =
  | { kind: 'passkey'; deviceName: string }
  | { kind: 'password'; password: string; deviceName: string };

/**
 * Finishes setup: a passkey (options from the server, the browser's prompt, then the server checks
 * it) or a password (10+ characters). A full session follows.
 */
export async function registerDevice(input: RegisterInput): Promise<ApiResult<SessionResponse>> {
  if (input.kind === 'password') return post('/api/auth/register', input);
  const asked = await request('/api/auth/register/options', parsePasskeyOptionsResponse, {
    method: 'POST',
  });
  if (!asked.ok) return asked;
  const made = await ceremony(() =>
    startRegistration({
      optionsJSON: asked.data.options as unknown as PublicKeyCredentialCreationOptionsJSON,
    }),
  );
  if (!made.ok) return made;
  return post('/api/auth/register', {
    kind: 'passkey',
    deviceName: input.deviceName,
    response: made.data,
  });
}

export function signInWithPassword(input: {
  slug: string;
  chefId?: string;
  password: string;
  deviceName: string;
}): Promise<ApiResult<SessionResponse>> {
  return post('/api/auth/password', { ...input, deviceId: getDeviceId() });
}

/**
 * Signs in with this device's passkey: options for the credential id kept at registration (or any
 * passkey the browser holds for this site), the browser's prompt, then the server checks the answer.
 */
export async function signInWithPasskey(): Promise<ApiResult<SessionResponse>> {
  const credentialId = getCredentialId();
  const deviceId = getDeviceId();
  const asked = await request('/api/auth/passkey/options', parsePasskeyOptionsResponse, {
    method: 'POST',
    body: { deviceId, ...(credentialId ? { credentialId } : {}) },
  });
  if (!asked.ok) return asked;
  const made = await ceremony(() =>
    startAuthentication({
      optionsJSON: asked.data.options as unknown as PublicKeyCredentialRequestOptionsJSON,
    }),
  );
  if (!made.ok) return made;
  return post('/api/auth/passkey', { deviceId, response: made.data });
}

export function fetchMe(): Promise<ApiResult<MeResponse>> {
  return request('/api/auth/me', parseMeResponse);
}

/** Ends this session (the device stays in the list); the server clears the cookie. */
export async function signOut(): Promise<ApiResult<OkResponse>> {
  const result = await request('/api/auth/sign-out', parseOkResponse, { method: 'POST' });
  setSessionHint(false);
  return result;
}

/** The signed-in account's own devices (the admin's, for the admin). */
export function fetchMyDevices(): Promise<ApiResult<DevicesResponse>> {
  return request('/api/auth/devices', parseDevicesResponse);
}

export function renameMyDevice(id: string, name: string): Promise<ApiResult<OkResponse>> {
  return request(`/api/auth/devices/${enc(id)}`, parseOkResponse, {
    method: 'PATCH',
    body: { name },
  });
}

/** Signs a device of this account out for good (a lost phone). */
export function signOutDevice(id: string): Promise<ApiResult<OkResponse>> {
  return request(`/api/auth/devices/${enc(id)}`, parseOkResponse, { method: 'DELETE' });
}

/** A one-time code (6 digits, 10 minutes) to set up another device. */
export function createDeviceCode(): Promise<ApiResult<CodeResponse>> {
  return request('/api/auth/device-codes', parseCodeResponse, { method: 'POST' });
}

/** Forgets a stored passkey on this device (sign-out of a revoked device). */
export function forgetPasskey(): void {
  clearCredentialId();
}

// ---- Admin ----

/** First-time admin: the setup key starts a setup session; then `registerDevice` with a passkey. */
export function adminSetup(setupKey: string): Promise<ApiResult<SessionResponse>> {
  return post('/api/admin/setup', { setupKey, deviceId: getDeviceId() });
}

export function fetchSellers(): Promise<ApiResult<SellersResponse>> {
  return request('/api/admin/sellers', parseSellersResponse);
}

/** `slug` is checked with isValidSlug; 409 `slug_taken` when it is not unique. */
export function createSeller(name: string, slug: string): Promise<ApiResult<SellerResponse>> {
  return request('/api/admin/sellers', parseSellerResponse, {
    method: 'POST',
    body: { name, slug },
  });
}

/** Shown once; only its hash is kept. */
export function createInviteKey(sellerId: string): Promise<ApiResult<KeyResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/invite-key`, parseKeyResponse, {
    method: 'POST',
  });
}

export function createRecoveryKey(sellerId: string): Promise<ApiResult<KeyResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/recovery-key`, parseKeyResponse, {
    method: 'POST',
  });
}

export function fetchSellerDevices(sellerId: string): Promise<ApiResult<DevicesResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/devices`, parseDevicesResponse);
}

export function signOutSellerDevice(
  sellerId: string,
  deviceId: string,
): Promise<ApiResult<OkResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/devices/${enc(deviceId)}`, parseOkResponse, {
    method: 'DELETE',
  });
}

/** The seller's chefs with their device counts (admin: names and counts only). */
export function fetchSellerChefs(sellerId: string): Promise<ApiResult<ChefAccessResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/chefs`, parseChefAccessResponse);
}

/** Signs every device of one chef out; the chef needs a new invite to come back. */
export function signOutChefEverywhere(
  sellerId: string,
  chefId: string,
): Promise<ApiResult<OkResponse>> {
  return request(
    `/api/admin/sellers/${enc(sellerId)}/chefs/${enc(chefId)}/sign-out-all`,
    parseOkResponse,
    { method: 'POST' },
  );
}

// ---- Seller ----

/** The seller invites a chef from the chefs list (not for chefs themselves). */
export function createChefInvite(chefId: string, seller?: string): Promise<ApiResult<KeyResponse>> {
  return request('/api/seller/chef-invites', parseKeyResponse, {
    method: 'POST',
    body: { chefId },
    ...(seller ? { seller } : {}),
  });
}

/** Each chef with the number of devices signed in as them (seller only). */
export function fetchChefDevices(seller?: string): Promise<ApiResult<ChefAccessResponse>> {
  return request('/api/seller/chef-devices', parseChefAccessResponse, {
    ...(seller ? { seller } : {}),
  });
}
