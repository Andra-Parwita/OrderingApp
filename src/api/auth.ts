// Sign-in, devices and admin calls (stage 7.1). A call that returns a session stores its token
// (and, for a passkey, the credential id) on this device; `request` then sends the token as
// `Authorization: Bearer` on every call. Passkeys are simulated until phase 4 (D-045).
import {
  parseChefAccessResponse,
  parseCodeResponse,
  parseDevicesResponse,
  parseKeyResponse,
  parseMeResponse,
  parseSellerResponse,
  parseSellersResponse,
  parseSessionResponse,
  type ChefAccessResponse,
  type CodeResponse,
  type DevicesResponse,
  type KeyResponse,
  type MeResponse,
  type RegisterRequest,
  type SellerResponse,
  type SellersResponse,
  type SessionResponse,
} from '../../shared/authContract';
import { parseOkResponse, type OkResponse } from '../../shared/setupContract';
import {
  clearCredentialId,
  clearSessionToken,
  getCredentialId,
  getDeviceId,
  setCredentialId,
  setSessionToken,
} from './device/session';
import { request, type ApiResult } from './http';

const enc = encodeURIComponent;

async function keepSession(
  call: Promise<ApiResult<SessionResponse>>,
): Promise<ApiResult<SessionResponse>> {
  const result = await call;
  if (result.ok) {
    setSessionToken(result.data.token);
    if (result.data.credentialId) setCredentialId(result.data.credentialId);
  }
  return result;
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

/** Finishes setup: the simulated passkey or a password (10+ characters); a full session follows. */
export function registerDevice(input: RegisterRequest): Promise<ApiResult<SessionResponse>> {
  return post('/api/auth/register', input);
}

export function signInWithPassword(input: {
  slug: string;
  chefId?: string;
  password: string;
  deviceName: string;
}): Promise<ApiResult<SessionResponse>> {
  return post('/api/auth/password', { ...input, deviceId: getDeviceId() });
}

/** Uses the credential id this device kept at registration; 401 `invalid_credentials` without one. */
export function signInWithPasskey(): Promise<ApiResult<SessionResponse>> {
  return post('/api/auth/passkey', {
    credentialId: getCredentialId() ?? 'none',
    deviceId: getDeviceId(),
  });
}

export function fetchMe(): Promise<ApiResult<MeResponse>> {
  return request('/api/auth/me', parseMeResponse);
}

/** Ends this session (the device stays in the list); forgets the token either way. */
export async function signOut(): Promise<ApiResult<OkResponse>> {
  const result = await request('/api/auth/sign-out', parseOkResponse, { method: 'POST' });
  clearSessionToken();
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
