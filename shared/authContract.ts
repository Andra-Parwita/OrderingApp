// Sign-in contract (stage 7.1; D-011, D-013, D-027 row 1, D-045). The passkey step is simulated in
// the dev mock; phase 4 keeps these shapes and swaps in WebAuthn, D1 sessions and rate limits.
import type { Seller } from './domain';
import { isInt, isIsoDate, isOneOf, isRecord, parseArray } from './parse';
import { parseSeller } from './seller';

export const ROLES = ['admin', 'seller', 'chef'] as const;
export type Role = (typeof ROLES)[number];

/** Invite and recovery keys: valid 24 hours, usable on up to 3 devices. */
export const KEY_TTL_HOURS = 24;
export const KEY_MAX_DEVICES = 3;
/** Add-device code: 6 digits, 10 minutes, one use. */
export const CODE_TTL_MINUTES = 10;
export const CODE_LENGTH = 6;
/** A session lasts 30 days and is renewed on every use (D-011). */
export const SESSION_DAYS = 30;
/** The short session between a key and the finished setup (passkey or password). */
export const SETUP_SESSION_MINUTES = 60;
/** 5 failed tries (per device, and per seller) lock sign-in for 15 minutes (D-027 row 1). */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;
export const DEVICE_NAME_MAX = 40;
export const SELLER_NAME_MAX = 60;

export type PasswordStrength = 'ok' | 'too_short' | 'too_long';
export function checkPassword(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN) return 'too_short';
  return password.length > PASSWORD_MAX ? 'too_long' : 'ok';
}

/** Who a session is, as the app shows it. `stage: 'setup'` may only finish registering. */
export type Me = {
  role: Role;
  stage: 'setup' | 'full';
  /** Not for admin. */
  sellerId?: string;
  slug?: string;
  sellerName?: string;
  /** Chef only. */
  chefId?: string;
  chefName?: string;
  /** Present once the device is registered (full sessions). */
  deviceId?: string;
  deviceName?: string;
};

export type DeviceView = {
  id: string;
  name: string;
  role: Role;
  chefId?: string;
  chefName?: string;
  createdAt: string;
  lastUsedAt: string;
  /** Set on the caller's own device in their own list. */
  current?: true;
};

// ---- Requests ----

/** `deviceId` is the random id the client keeps per browser; lockouts are counted on it. */
export type DeviceIdField = { deviceId: string };
export type AdminSetupRequest = DeviceIdField & { setupKey: string };
export type KeySignInRequest = DeviceIdField & { key: string };
export type CodeSignInRequest = DeviceIdField & { code: string };
export type PasswordSignInRequest = DeviceIdField & {
  slug: string;
  chefId?: string;
  password: string;
  deviceName: string;
};
export type PasskeySignInRequest = DeviceIdField & { credentialId: string };
export type RegisterRequest =
  | { kind: 'passkey'; deviceName: string }
  | { kind: 'password'; password: string; deviceName: string };
export type RenameDeviceRequest = { name: string };
export type CreateSellerRequest = { name: string; slug: string };
export type ChefInviteRequest = { chefId: string };

// ---- Responses ----

/** `credentialId` comes back from a passkey registration; the device keeps it to sign in later. */
export type SessionResponse = { token: string; me: Me; credentialId?: string };
export type MeResponse = { me: Me };
export type DevicesResponse = { devices: Array<DeviceView> };
export type KeyResponse = { key: string; expiresAt: string; maxDevices: number };
export type CodeResponse = { code: string; expiresAt: string };
/** A seller as the admin lists it: when it was added is shown there only. */
export type AdminSeller = Seller & { createdAt: string };
export type SellersResponse = { sellers: Array<AdminSeller> };
export type SellerResponse = { seller: AdminSeller };
/** A chef and how many devices are signed in as them (names and counts only, no order data). */
export type ChefAccess = { id: string; name: string; devices: number };
export type ChefAccessResponse = { chefs: Array<ChefAccess> };

// ---- Parsers ----

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= max ? trimmed : null;
}

function deviceIdOf(input: Record<string, unknown>): string | null {
  const { deviceId } = input;
  return typeof deviceId === 'string' && DEVICE_ID.test(deviceId) ? deviceId : null;
}

export function parseAdminSetupRequest(input: unknown): AdminSetupRequest | null {
  if (!isRecord(input)) return null;
  const deviceId = deviceIdOf(input);
  const setupKey = text(input['setupKey'], 100);
  return deviceId && setupKey ? { deviceId, setupKey } : null;
}

export function parseKeySignInRequest(input: unknown): KeySignInRequest | null {
  if (!isRecord(input)) return null;
  const deviceId = deviceIdOf(input);
  const key = text(input['key'], 100);
  return deviceId && key ? { deviceId, key } : null;
}

export function parseCodeSignInRequest(input: unknown): CodeSignInRequest | null {
  if (!isRecord(input)) return null;
  const deviceId = deviceIdOf(input);
  const code = text(input['code'], 20);
  return deviceId && code ? { deviceId, code } : null;
}

export function parsePasskeySignInRequest(input: unknown): PasskeySignInRequest | null {
  if (!isRecord(input)) return null;
  const deviceId = deviceIdOf(input);
  const credentialId = text(input['credentialId'], 200);
  return deviceId && credentialId ? { deviceId, credentialId } : null;
}

/** The password is not trimmed; only its length is bounded at sign-in (no hints about strength). */
export function parsePasswordSignInRequest(input: unknown): PasswordSignInRequest | null {
  if (!isRecord(input)) return null;
  const deviceId = deviceIdOf(input);
  const slug = text(input['slug'], 100);
  const deviceName = text(input['deviceName'], DEVICE_NAME_MAX);
  const { password, chefId } = input;
  if (!deviceId || !slug || !deviceName) return null;
  if (typeof password !== 'string' || password.length < 1 || password.length > PASSWORD_MAX) {
    return null;
  }
  if (chefId !== undefined && (typeof chefId !== 'string' || chefId === '')) return null;
  return { deviceId, slug, password, deviceName, ...(chefId !== undefined ? { chefId } : {}) };
}

/** A password shorter than PASSWORD_MIN is rejected here (400 `invalid_request`). */
export function parseRegisterRequest(input: unknown): RegisterRequest | null {
  if (!isRecord(input)) return null;
  const deviceName = text(input['deviceName'], DEVICE_NAME_MAX);
  if (!deviceName) return null;
  if (input['kind'] === 'passkey') return { kind: 'passkey', deviceName };
  const { password } = input;
  if (input['kind'] === 'password' && typeof password === 'string') {
    return checkPassword(password) === 'ok' ? { kind: 'password', password, deviceName } : null;
  }
  return null;
}

export function parseRenameDeviceRequest(input: unknown): RenameDeviceRequest | null {
  if (!isRecord(input)) return null;
  const name = text(input['name'], DEVICE_NAME_MAX);
  return name ? { name } : null;
}

export function parseCreateSellerRequest(input: unknown): CreateSellerRequest | null {
  if (!isRecord(input)) return null;
  const name = text(input['name'], SELLER_NAME_MAX);
  const { slug } = input;
  return name && typeof slug === 'string' ? { name, slug } : null;
}

export function parseChefInviteRequest(input: unknown): ChefInviteRequest | null {
  if (!isRecord(input)) return null;
  const chefId = text(input['chefId'], 100);
  return chefId ? { chefId } : null;
}

export function parseMe(input: unknown): Me | null {
  if (!isRecord(input)) return null;
  const { role, stage, sellerId, slug, sellerName, chefId, chefName, deviceId, deviceName } = input;
  if (!isOneOf(ROLES, role) || (stage !== 'setup' && stage !== 'full')) return null;
  for (const value of [sellerId, slug, sellerName, chefId, chefName, deviceId, deviceName]) {
    if (value !== undefined && typeof value !== 'string') return null;
  }
  return {
    role,
    stage,
    ...(typeof sellerId === 'string' ? { sellerId } : {}),
    ...(typeof slug === 'string' ? { slug } : {}),
    ...(typeof sellerName === 'string' ? { sellerName } : {}),
    ...(typeof chefId === 'string' ? { chefId } : {}),
    ...(typeof chefName === 'string' ? { chefName } : {}),
    ...(typeof deviceId === 'string' ? { deviceId } : {}),
    ...(typeof deviceName === 'string' ? { deviceName } : {}),
  };
}

export function parseSessionResponse(input: unknown): SessionResponse | null {
  if (!isRecord(input)) return null;
  const me = parseMe(input['me']);
  const { token, credentialId } = input;
  if (!me || typeof token !== 'string' || token === '') return null;
  if (credentialId !== undefined && typeof credentialId !== 'string') return null;
  return { token, me, ...(credentialId !== undefined ? { credentialId } : {}) };
}

export function parseMeResponse(input: unknown): MeResponse | null {
  if (!isRecord(input)) return null;
  const me = parseMe(input['me']);
  return me ? { me } : null;
}

function parseDevice(input: unknown): DeviceView | null {
  if (!isRecord(input)) return null;
  const { id, name, role, chefId, chefName, createdAt, lastUsedAt, current } = input;
  if (typeof id !== 'string' || typeof name !== 'string' || !isOneOf(ROLES, role)) return null;
  if (!isIsoDate(createdAt) || !isIsoDate(lastUsedAt)) return null;
  if (chefId !== undefined && typeof chefId !== 'string') return null;
  if (chefName !== undefined && typeof chefName !== 'string') return null;
  return {
    id,
    name,
    role,
    createdAt,
    lastUsedAt,
    ...(typeof chefId === 'string' ? { chefId } : {}),
    ...(typeof chefName === 'string' ? { chefName } : {}),
    ...(current === true ? { current: true as const } : {}),
  };
}

export function parseDevicesResponse(input: unknown): DevicesResponse | null {
  if (!isRecord(input)) return null;
  const devices = parseArray(input['devices'], parseDevice);
  return devices ? { devices } : null;
}

export function parseKeyResponse(input: unknown): KeyResponse | null {
  if (!isRecord(input)) return null;
  const { key, expiresAt, maxDevices } = input;
  if (typeof key !== 'string' || !isIsoDate(expiresAt) || !isInt(maxDevices, 1, 100)) return null;
  return { key, expiresAt, maxDevices };
}

export function parseCodeResponse(input: unknown): CodeResponse | null {
  if (!isRecord(input)) return null;
  const { code, expiresAt } = input;
  return typeof code === 'string' && isIsoDate(expiresAt) ? { code, expiresAt } : null;
}

function parseAdminSeller(input: unknown): AdminSeller | null {
  const seller = parseSeller(input);
  if (!seller || !isRecord(input)) return null;
  const { createdAt } = input;
  return isIsoDate(createdAt) ? { ...seller, createdAt } : null;
}

export function parseSellersResponse(input: unknown): SellersResponse | null {
  if (!isRecord(input)) return null;
  const sellers = parseArray(input['sellers'], parseAdminSeller);
  return sellers ? { sellers } : null;
}

export function parseSellerResponse(input: unknown): SellerResponse | null {
  if (!isRecord(input)) return null;
  const seller = parseAdminSeller(input['seller']);
  return seller ? { seller } : null;
}

function parseChefAccess(input: unknown): ChefAccess | null {
  if (!isRecord(input)) return null;
  const { id, name, devices } = input;
  if (typeof id !== 'string' || id === '' || typeof name !== 'string') return null;
  return isInt(devices, 0, 1000) ? { id, name, devices } : null;
}

export function parseChefAccessResponse(input: unknown): ChefAccessResponse | null {
  if (!isRecord(input)) return null;
  const chefs = parseArray(input['chefs'], parseChefAccess);
  return chefs ? { chefs } : null;
}
