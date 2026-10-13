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
  parseInvitesResponse,
  parseMembersResponse,
  parseMembershipsResponse,
  parseTeamNamesResponse,
  parsePasskeyOptionsResponse,
  parseSellerResponse,
  passkeysAvailable,
  parseSellersResponse,
  parseSessionResponse,
  type ChefAccessResponse,
  type CodeResponse,
  type DevicesResponse,
  type InviteRequest,
  type KeyResponse,
  type InvitesResponse,
  type MembersResponse,
  type MembershipsResponse,
  type MeResponse,
  type SellerResponse,
  type SellersResponse,
  type SessionResponse,
  type TeamNamesResponse,
} from '../../shared/authContract';
import {
  parseLogListResponse,
  type LogListResponse,
  type LogQuery,
} from '../../shared/logContract';
import type { PauseKind } from '../../shared/domain';
import {
  parseBackupMinutes,
  parseMaintenanceState,
  type BackupMinutes,
  type MaintenancePatch,
  type MaintenanceState,
} from '../../shared/maintenance';
import type { ImageSlot } from '../../shared/imageSlots';
import {
  parseImagesResponse,
  parseOkResponse,
  type ImagesResponse,
  type OkResponse,
} from '../../shared/setupContract';
import {
  clearCredentialId,
  getCredentialId,
  getDeviceId,
  setCredentialId,
  setSessionHint,
  type CredentialRole,
} from './device/session';
import { reportPasskeyError } from './clientLog';
import { request, type ApiResult } from './http';

const enc = encodeURIComponent;

/** The credential id of a new passkey is kept (public data) to ask for sign-in options later. */
async function keepSession(
  call: Promise<ApiResult<SessionResponse>>,
): Promise<ApiResult<SessionResponse>> {
  const result = await call;
  if (result.ok) {
    setSessionHint(true);
    if (result.data.credentialId) {
      setCredentialId(
        result.data.me.role === 'admin' ? 'admin' : 'staff',
        result.data.credentialId,
      );
    }
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
    // Plan 025: creating a passkey is refused when this device already holds one for the account.
    const held = name === 'InvalidStateError';
    if (!cancelled && !held) reportPasskeyError(name, cause instanceof Error ? cause.message : '');
    return {
      ok: false,
      error: held ? 'passkey_exists' : cancelled ? 'passkey_cancelled' : 'passkey_failed',
      status: 0,
      message: cause instanceof Error ? cause.message : 'Passkey failed',
    };
  }
}

const post = (path: string, body: unknown) =>
  keepSession(request(path, parseSessionResponse, { method: 'POST', body }));

/**
 * An invite key. Signed out: starts setup for a NEW person (`displayName` is their edit of the
 * invite's name). Signed in as a person: joins the kitchen (the answer is a full session in it).
 */
export function signInWithKey(
  key: string,
  displayName?: string,
): Promise<ApiResult<SessionResponse>> {
  return post('/api/auth/invite', {
    key,
    deviceId: getDeviceId(),
    ...(displayName ? { displayName } : {}),
  });
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

/** A person of the kitchen (`accountId` from `fetchTeamNames`) by password. */
export function signInWithPassword(input: {
  slug: string;
  accountId: string;
  password: string;
  deviceName: string;
}): Promise<ApiResult<SessionResponse>> {
  return post('/api/auth/password', { ...input, deviceId: getDeviceId() });
}

/**
 * Signs in with a passkey: the browser's prompt, then the server checks the answer (it finds the
 * device by the credential id in the answer). The id kept for `role` is only a hint that narrows
 * the list; with `discoverable` (or no kept id) the browser offers every passkey for this site.
 */
export async function signInWithPasskey(
  role: CredentialRole,
  discoverable = false,
  slug?: string,
): Promise<ApiResult<SessionResponse>> {
  const credentialId = discoverable ? null : getCredentialId(role);
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
  return post('/api/auth/passkey', { deviceId, response: made.data, ...(slug ? { slug } : {}) });
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

/** The kitchens of the signed-in person (empty for the admin). */
export function fetchMemberships(): Promise<ApiResult<MembershipsResponse>> {
  return request('/api/auth/memberships', parseMembershipsResponse);
}

/** Makes another kitchen of this person the active one; the answer is the new `me`. */
export function switchKitchen(sellerId: string): Promise<ApiResult<MeResponse>> {
  return request('/api/auth/switch', parseMeResponse, { method: 'POST', body: { sellerId } });
}

/** Public: people of a kitchen who have a password, for the password sign-in picker. */
export function fetchTeamNames(slug: string): Promise<ApiResult<TeamNamesResponse>> {
  return request(`/api/s/${enc(slug)}/team-names`, parseTeamNamesResponse);
}

/** Forgets the kept passkey hint of one kind of account (sign-out of a revoked device). */
export function forgetPasskey(role: CredentialRole): void {
  clearCredentialId(role);
}

// ---- Admin ----

/** First-time admin: the setup key starts a setup session; then `registerDevice` with a passkey. */
export function adminSetup(setupKey: string): Promise<ApiResult<SessionResponse>> {
  return post('/api/admin/setup', { setupKey, deviceId: getDeviceId() });
}

/** The newest client problems (plan 026), admin only. */
export function fetchAdminLog(query: LogQuery): Promise<ApiResult<LogListResponse>> {
  const params = new URLSearchParams();
  if (query.app) params.set('app', query.app);
  if (query.slug) params.set('slug', query.slug);
  if (query.offset > 0) params.set('offset', String(query.offset));
  const text = params.toString();
  return request(`/api/admin/log${text ? `?${text}` : ''}`, parseLogListResponse);
}

/** Deletes every logged problem (admin only). */
export function clearAdminLog(): Promise<ApiResult<OkResponse>> {
  return request('/api/admin/log', parseOkResponse, { method: 'DELETE' });
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

/** Plan 013: switch a kitchen into or out of demo mode (admin only). */
export function setSellerDemo(sellerId: string, demo: boolean): Promise<ApiResult<SellerResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}`, parseSellerResponse, {
    method: 'PATCH',
    body: { demo },
  });
}

/** Plan 032: pause a kitchen (`full` signs everyone out) or resume it (admin only). */
export function setSellerPaused(
  sellerId: string,
  kind: PauseKind | null,
): Promise<ApiResult<SellerResponse>> {
  return request(
    `/api/admin/sellers/${enc(sellerId)}/${kind === null ? 'resume' : 'pause'}`,
    parseSellerResponse,
    { method: 'POST', ...(kind === null ? {} : { body: { kind } }) },
  );
}

/** An invite for a first owner (one device, 24 hours). Shown once; only its hash is kept. */
export function createInviteKey(
  sellerId: string,
  displayName?: string,
): Promise<ApiResult<KeyResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/invite-key`, parseKeyResponse, {
    method: 'POST',
    ...(displayName ? { body: { displayName } } : {}),
  });
}

/** The same call as an invite (D-090: recovery is a re-invite). */
export function createRecoveryKey(
  sellerId: string,
  displayName?: string,
): Promise<ApiResult<KeyResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/recovery-key`, parseKeyResponse, {
    method: 'POST',
    ...(displayName ? { body: { displayName } } : {}),
  });
}

/** The people of a kitchen: name, role, device count (the admin's replacement for the devices view). */
export function fetchSellerInvites(sellerId: string): Promise<ApiResult<InvitesResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/invites`, parseInvitesResponse);
}

export function fetchSellerMembers(sellerId: string): Promise<ApiResult<MembersResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/members`, parseMembersResponse);
}

export function removeSellerMember(
  sellerId: string,
  accountId: string,
): Promise<ApiResult<OkResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/members/${enc(accountId)}`, parseOkResponse, {
    method: 'DELETE',
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

/** Plan 041: a kitchen's five pictures, set by the admin (the same slots as the seller's). */
export function fetchSellerImages(sellerId: string): Promise<ApiResult<ImagesResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/images`, parseImagesResponse);
}

/** `dataUrl` is already resized to the slot's size; the server checks type, size and shape. */
export function uploadSellerImage(
  sellerId: string,
  slot: ImageSlot,
  dataUrl: string,
): Promise<ApiResult<ImagesResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/images/${enc(slot)}`, parseImagesResponse, {
    method: 'PUT',
    body: { dataUrl },
  });
}

export function removeSellerImage(
  sellerId: string,
  slot: ImageSlot,
): Promise<ApiResult<ImagesResponse>> {
  return request(`/api/admin/sellers/${enc(sellerId)}/images/${enc(slot)}`, parseImagesResponse, {
    method: 'DELETE',
  });
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

/** The owner invites a person by name and role (a chef without `chefId` also becomes a cook). */
export function createInvite(
  input: InviteRequest,
  seller?: string,
): Promise<ApiResult<KeyResponse>> {
  return request('/api/seller/invites', parseKeyResponse, {
    method: 'POST',
    body: input,
    ...(seller ? { seller } : {}),
  });
}

/** The kitchen's people (owner only). */
export function fetchTeam(seller?: string): Promise<ApiResult<MembersResponse>> {
  return request('/api/seller/team', parseMembersResponse, { ...(seller ? { seller } : {}) });
}

/** Removes a member (owner only, not yourself): their sessions here end at once. */
export function removeTeamMember(
  accountId: string,
  seller?: string,
): Promise<ApiResult<OkResponse>> {
  return request(`/api/seller/team/${enc(accountId)}`, parseOkResponse, {
    method: 'DELETE',
    ...(seller ? { seller } : {}),
  });
}

/** Plan 046: the announced update and maintenance on/off (admin only). */
export function fetchMaintenance(): Promise<ApiResult<MaintenanceState>> {
  return request('/api/admin/maintenance', parseMaintenanceState);
}

export function saveMaintenance(patch: MaintenancePatch): Promise<ApiResult<MaintenanceState>> {
  return request('/api/admin/maintenance', parseMaintenanceState, { method: 'PATCH', body: patch });
}

/** Plan 074: the two backup-check intervals in minutes (admin only). */
export function fetchBackupMinutes(): Promise<ApiResult<BackupMinutes>> {
  return request('/api/admin/backup-minutes', (input) => parseBackupMinutes(input));
}

export function saveBackupMinutes(
  patch: Partial<BackupMinutes>,
): Promise<ApiResult<BackupMinutes>> {
  return request('/api/admin/backup-minutes', (input) => parseBackupMinutes(input), {
    method: 'PATCH',
    body: patch,
  });
}
