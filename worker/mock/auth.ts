// Dev-mock sign-in: accounts, devices, sessions, keys, codes and lockouts, all in memory (stage
// 7.1). Pure apart from WebCrypto and the injected clock, so unit tests and MSW reuse it.
//
// Phase 4 replaces this: sessions and keys in D1, real WebAuthn instead of the simulated passkey,
// the `ADMIN_SETUP_KEY` secret instead of the constant below, and Cloudflare rate limits.
import {
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  KEY_MAX_DEVICES,
  KEY_TTL_HOURS,
  LOCKOUT_MINUTES,
  MAX_FAILED_ATTEMPTS,
  SESSION_DAYS,
  SETUP_SESSION_MINUTES,
  type CodeResponse,
  type DeviceView,
  type KeyResponse,
  type Me,
  type PasskeySignInRequest,
  type PasswordSignInRequest,
  type RegisterRequest,
  type Role,
  type SessionResponse,
} from '../../shared/authContract';
import type { ApiErrorCode } from '../../shared/apiError';
import type { Seller } from '../../shared/domain';
import { ORDER_CODE_ALPHABET } from '../../shared/orderCode';

/** Phase 4 reads the `ADMIN_SETUP_KEY` secret (Cloudflare, or `.dev.vars` locally) instead. */
export const DEV_ADMIN_SETUP_KEY = 'DLV-DEVA-DMIN-SETU-PKEY';

const MINUTE = 60_000;
const PBKDF2_ITERATIONS = 100_000; // the most the Workers runtime allows

export type AuthFail = {
  ok: false;
  error: ApiErrorCode;
  message: string;
  triesLeft?: number;
  retryAfterSeconds?: number;
};
export type AuthResult<T> = { ok: true; value: T } | AuthFail;

const ok = <T>(value: T): AuthResult<T> => ({ ok: true, value });
const fail = (error: ApiErrorCode, message: string): AuthFail => ({ ok: false, error, message });
const INVALID: AuthFail = fail('invalid_credentials', 'Not valid or expired');

type Account = {
  id: string;
  role: Role;
  sellerId?: string;
  chefId?: string;
  password?: { salt: string; hash: string; iterations: number };
};
type Device = {
  id: string;
  accountId: string;
  name: string;
  /** The simulated passkey; absent for a device that signs in by password. */
  credentialId?: string;
  createdAt: number;
  lastUsedAt: number;
};
type Via = 'admin-setup' | 'key' | 'code';
type Session = {
  token: string;
  accountId: string;
  /** Absent on a setup session (the device is created when registration finishes). */
  deviceId?: string;
  via?: Via;
  expiresAt: number;
};
type KeyRecord = {
  hash: string;
  accountId: string;
  kind: 'invite' | 'recovery';
  expiresAt: number;
  redeemedBy: Array<string>;
};
type CodeRecord = { hash: string; accountId: string; expiresAt: number; used: boolean };

export type AuthLookup = {
  sellerById: (id: string) => Seller | undefined;
  sellerBySlug: (slug: string) => Seller | undefined;
  chefName: (sellerId: string, chefId: string) => string | undefined;
};

/** A live session, resolved from its token. */
export type Caller = {
  token: string;
  role: Role;
  setup: boolean;
  sellerId?: string;
  chefId?: string;
  accountId: string;
  deviceId?: string;
};

// ---- WebCrypto helpers ----

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 as hex: how keys and codes are kept (the plain value is never stored). */
export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

async function pbkdf2Hex(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    256,
  );
  return hex(bits);
}

function fromHex(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Characters from the order-code alphabet (32 symbols, so a byte maps without bias). */
function randomChars(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => ORDER_CODE_ALPHABET.charAt(byte % 32)).join('');
}

function randomDigits(length: number): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return [...bytes].map((value) => String(value % 10)).join('');
}

/** "dlv 7kq4-m9xp-2htr-w3nc" and "7KQ4M9XP2HTRW3NC" both become "DLV7KQ4M9XP2HTRW3NC". */
export function normaliseKey(input: string): string {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length === 16 ? `DLV${clean}` : clean;
}

function formatKey(body: string): string {
  return `DLV-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12)}`;
}

export function createAuthStore(options: { now: () => Date }, lookup: AuthLookup) {
  const now = () => options.now().getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  let accounts = new Map<string, Account>();
  let devices = new Map<string, Device>();
  let sessions = new Map<string, Session>();
  let keys: Array<KeyRecord> = [];
  let codes: Array<CodeRecord> = [];
  let attempts = new Map<string, { fails: number; lockedUntil: number }>();
  let counter = 0;

  const newId = () => `dev-${String(++counter)}-${randomChars(6).toLowerCase()}`;

  // ---- Lockout (D-027 row 1): 5 failed tries per device id and per seller, then 15 minutes ----

  function lockedSeconds(scopes: ReadonlyArray<string>): number {
    let until = 0;
    for (const scope of scopes) {
      const entry = attempts.get(scope);
      if (!entry) continue;
      if (entry.lockedUntil > 0 && entry.lockedUntil <= now()) attempts.delete(scope);
      else until = Math.max(until, entry.lockedUntil);
    }
    return until > now() ? Math.ceil((until - now()) / 1000) : 0;
  }

  function lockedFail(seconds: number): AuthFail {
    return {
      ...fail('locked_out', 'Too many tries. Try again later.'),
      retryAfterSeconds: seconds,
    };
  }

  /** The 5th failure locks at once, so it answers `locked_out`; earlier ones say how many are left. */
  function recordFailure(scopes: ReadonlyArray<string>): AuthFail {
    let worst = 0;
    for (const scope of scopes) {
      const entry = attempts.get(scope) ?? { fails: 0, lockedUntil: 0 };
      entry.fails += 1;
      if (entry.fails >= MAX_FAILED_ATTEMPTS) entry.lockedUntil = now() + LOCKOUT_MINUTES * MINUTE;
      attempts.set(scope, entry);
      worst = Math.max(worst, entry.fails);
    }
    const seconds = lockedSeconds(scopes);
    if (seconds > 0) return lockedFail(seconds);
    return { ...INVALID, triesLeft: MAX_FAILED_ATTEMPTS - worst };
  }

  function clearFailures(scopes: ReadonlyArray<string>): void {
    for (const scope of scopes) attempts.delete(scope);
  }

  /** Runs one attempt: refused while locked; a null answer counts as a failed try. */
  async function guarded<T>(
    scopes: Array<string>,
    attempt: () => Promise<T | null> | T | null,
  ): Promise<AuthResult<T>> {
    const locked = lockedSeconds(scopes);
    if (locked > 0) return lockedFail(locked);
    const value = await attempt();
    if (value === null) return recordFailure(scopes);
    clearFailures(scopes);
    return ok(value);
  }

  // ---- Accounts, sessions and devices ----

  function accountFor(role: Role, sellerId?: string, chefId?: string): Account {
    const id =
      role === 'admin'
        ? 'admin'
        : role === 'seller'
          ? `seller:${sellerId}`
          : `chef:${sellerId}:${chefId}`;
    let account = accounts.get(id);
    if (!account) {
      account = {
        id,
        role,
        ...(sellerId !== undefined ? { sellerId } : {}),
        ...(chefId !== undefined ? { chefId } : {}),
      };
      accounts.set(id, account);
    }
    return account;
  }

  function meOf(account: Account, device: Device | undefined, setup: boolean): Me {
    const seller = account.sellerId ? lookup.sellerById(account.sellerId) : undefined;
    const chefName =
      account.sellerId && account.chefId
        ? lookup.chefName(account.sellerId, account.chefId)
        : undefined;
    return {
      role: account.role,
      stage: setup ? 'setup' : 'full',
      ...(seller ? { sellerId: seller.id, slug: seller.slug, sellerName: seller.name } : {}),
      ...(account.chefId ? { chefId: account.chefId } : {}),
      ...(chefName ? { chefName } : {}),
      ...(device ? { deviceId: device.id, deviceName: device.name } : {}),
    };
  }

  function startSetup(account: Account, via: Via): SessionResponse {
    const token = randomChars(40);
    sessions.set(token, {
      token,
      accountId: account.id,
      via,
      expiresAt: now() + SETUP_SESSION_MINUTES * MINUTE,
    });
    return { token, me: meOf(account, undefined, true) };
  }

  /** One session per device: signing in again replaces the old token. */
  function startSession(account: Account, device: Device, credentialId?: string): SessionResponse {
    for (const [token, session] of sessions)
      if (session.deviceId === device.id) sessions.delete(token);
    const token = randomChars(40);
    device.lastUsedAt = now();
    sessions.set(token, {
      token,
      accountId: account.id,
      deviceId: device.id,
      expiresAt: now() + SESSION_DAYS * 24 * 60 * MINUTE,
    });
    return {
      token,
      me: meOf(account, device, false),
      ...(credentialId !== undefined ? { credentialId } : {}),
    };
  }

  function addDevice(account: Account, name: string, credentialId?: string): Device {
    const device: Device = {
      id: newId(),
      accountId: account.id,
      name,
      ...(credentialId !== undefined ? { credentialId } : {}),
      createdAt: now(),
      lastUsedAt: now(),
    };
    devices.set(device.id, device);
    return device;
  }

  function dropDevice(deviceId: string): void {
    devices.delete(deviceId);
    for (const [token, session] of sessions)
      if (session.deviceId === deviceId) sessions.delete(token);
  }

  function dropAccount(accountId: string): void {
    for (const device of [...devices.values()])
      if (device.accountId === accountId) dropDevice(device.id);
    for (const [token, session] of sessions)
      if (session.accountId === accountId) sessions.delete(token);
    keys = keys.filter((key) => key.accountId !== accountId);
    codes = codes.filter((code) => code.accountId !== accountId);
    accounts.delete(accountId);
  }

  function viewOf(device: Device, currentId?: string): DeviceView {
    const account = accounts.get(device.accountId) as Account;
    const chefName =
      account.sellerId && account.chefId
        ? lookup.chefName(account.sellerId, account.chefId)
        : undefined;
    return {
      id: device.id,
      name: device.name,
      role: account.role,
      ...(account.chefId ? { chefId: account.chefId } : {}),
      ...(chefName ? { chefName } : {}),
      createdAt: iso(device.createdAt),
      lastUsedAt: iso(device.lastUsedAt),
      ...(device.id === currentId ? { current: true as const } : {}),
    };
  }

  function adminExists(): boolean {
    return [...devices.values()].some((device) => accounts.get(device.accountId)?.role === 'admin');
  }

  async function makeKey(account: Account, kind: 'invite' | 'recovery'): Promise<KeyResponse> {
    const body = randomChars(16);
    const expiresAt = now() + KEY_TTL_HOURS * 60 * MINUTE;
    keys.push({
      hash: await sha256Hex(normaliseKey(body)),
      accountId: account.id,
      kind,
      expiresAt,
      redeemedBy: [],
    });
    return { key: formatKey(body), expiresAt: iso(expiresAt), maxDevices: KEY_MAX_DEVICES };
  }

  return {
    // ---- Reading a session ----

    /** The live session for a token, renewed on use (full sessions: 30 days from now). */
    resolve(token: string | undefined): Caller | undefined {
      if (!token) return undefined;
      const session = sessions.get(token);
      if (!session) return undefined;
      const account = accounts.get(session.accountId);
      const device = session.deviceId ? devices.get(session.deviceId) : undefined;
      if (session.expiresAt <= now() || !account || (session.deviceId && !device)) {
        sessions.delete(token);
        return undefined;
      }
      if (device) {
        device.lastUsedAt = now();
        session.expiresAt = now() + SESSION_DAYS * 24 * 60 * MINUTE;
      }
      return {
        token,
        role: account.role,
        setup: device === undefined,
        accountId: account.id,
        ...(account.sellerId !== undefined ? { sellerId: account.sellerId } : {}),
        ...(account.chefId !== undefined ? { chefId: account.chefId } : {}),
        ...(device ? { deviceId: device.id } : {}),
      };
    },

    me(caller: Caller): Me {
      const account = accounts.get(caller.accountId) as Account;
      return meOf(
        account,
        caller.deviceId ? devices.get(caller.deviceId) : undefined,
        caller.setup,
      );
    },

    /** When the session expires (ms since epoch); for tests. */
    expiryOf(token: string): number | undefined {
      return sessions.get(token)?.expiresAt;
    },

    // ---- Admin setup and keys ----

    adminExists,

    /** Refused once an admin has a registered device; a wrong key counts toward the lockout. */
    async adminSetup(setupKey: string, deviceId: string): Promise<AuthResult<SessionResponse>> {
      if (adminExists()) return fail('admin_exists', 'An admin is already set up');
      const result = await guarded([`device:${deviceId}`], () =>
        normaliseKey(setupKey) === normaliseKey(DEV_ADMIN_SETUP_KEY) ? true : null,
      );
      if (!result.ok) return result;
      return ok(startSetup(accountFor('admin'), 'admin-setup'));
    },

    /** Invite key (admin, for a seller) or chef invite (seller, for a chef). Shown once. */
    createKey(
      target:
        { role: 'seller'; sellerId: string } | { role: 'chef'; sellerId: string; chefId: string },
      kind: 'invite' | 'recovery',
    ): Promise<KeyResponse> {
      return makeKey(
        accountFor(
          target.role,
          target.sellerId,
          target.role === 'chef' ? target.chefId : undefined,
        ),
        kind,
      );
    },

    /**
     * A key becomes a setup session. Wrong, expired, used-up or already used on this device: one
     * plain error. Each redemption takes one of the key's 3 device slots.
     */
    async redeemKey(key: string, deviceId: string): Promise<AuthResult<SessionResponse>> {
      const hash = await sha256Hex(normaliseKey(key));
      const record = keys.find((candidate) => candidate.hash === hash);
      const seller = record ? accounts.get(record.accountId)?.sellerId : undefined;
      const result = await guarded(
        [`device:${deviceId}`, ...(seller ? [`seller:${seller}`] : [])],
        () => {
          if (!record || record.expiresAt <= now()) return null;
          if (record.redeemedBy.length >= KEY_MAX_DEVICES) return null;
          if (record.redeemedBy.includes(deviceId)) return null;
          return record;
        },
      );
      if (!result.ok) return result;
      result.value.redeemedBy.push(deviceId);
      return ok(startSetup(accounts.get(result.value.accountId) as Account, 'key'));
    },

    // ---- Add-device codes ----

    /** From a signed-in device: 6 digits, 10 minutes, one use. */
    async createCode(caller: Caller): Promise<CodeResponse> {
      let code = randomDigits(CODE_LENGTH);
      let hash = await sha256Hex(code);
      while (codes.some((c) => c.hash === hash && !c.used && c.expiresAt > now())) {
        code = randomDigits(CODE_LENGTH);
        hash = await sha256Hex(code);
      }
      const expiresAt = now() + CODE_TTL_MINUTES * MINUTE;
      codes.push({ hash, accountId: caller.accountId, expiresAt, used: false });
      return { code, expiresAt: iso(expiresAt) };
    },

    async redeemCode(code: string, deviceId: string): Promise<AuthResult<SessionResponse>> {
      const hash = await sha256Hex(code.replace(/\s/g, ''));
      const record = codes.find((c) => c.hash === hash && !c.used && c.expiresAt > now());
      const result = await guarded([`device:${deviceId}`], () => record ?? null);
      if (!result.ok) return result;
      result.value.used = true;
      return ok(startSetup(accounts.get(result.value.accountId) as Account, 'code'));
    },

    // ---- Finishing setup, signing in ----

    /**
     * A setup session becomes a device with a full session. Passkey: the mock invents the
     * credential id (phase 4: WebAuthn). Password: stored as PBKDF2; not for the admin, and not on
     * an add-device setup when the account already has a password.
     */
    async register(token: string, request: RegisterRequest): Promise<AuthResult<SessionResponse>> {
      const session = sessions.get(token);
      if (!session || session.expiresAt <= now() || session.deviceId) {
        return fail('unauthorized', 'Sign in first');
      }
      const account = accounts.get(session.accountId) as Account;
      if (request.kind === 'password') {
        if (account.role === 'admin') return fail('invalid_request', 'The admin uses a passkey');
        if (session.via === 'code' && account.password) {
          return fail('invalid_request', 'This account already has a password');
        }
        const salt = crypto.getRandomValues(new Uint8Array(16));
        account.password = {
          salt: hex(salt),
          hash: await pbkdf2Hex(request.password, salt, PBKDF2_ITERATIONS),
          iterations: PBKDF2_ITERATIONS,
        };
      }
      const credentialId =
        request.kind === 'passkey' ? `dev-passkey-${randomChars(24).toLowerCase()}` : undefined;
      const device = addDevice(account, request.deviceName, credentialId);
      sessions.delete(token);
      return ok(startSession(account, device, credentialId));
    },

    /** Seller or chef by password. A new device is added; the failure is the same for any cause. */
    async signInPassword(request: PasswordSignInRequest): Promise<AuthResult<SessionResponse>> {
      const seller = lookup.sellerBySlug(request.slug);
      const scopes = [`device:${request.deviceId}`, ...(seller ? [`seller:${seller.id}`] : [])];
      const result = await guarded(scopes, async () => {
        if (!seller) return null;
        const account = request.chefId
          ? accounts.get(`chef:${seller.id}:${request.chefId}`)
          : accounts.get(`seller:${seller.id}`);
        const stored = account?.password;
        if (!account || !stored) return null;
        const hash = await pbkdf2Hex(request.password, fromHex(stored.salt), stored.iterations);
        return hash === stored.hash ? account : null;
      });
      if (!result.ok) return result;
      return ok(startSession(result.value, addDevice(result.value, request.deviceName)));
    },

    /** The simulated passkey: the credential id made at registration, no real crypto. */
    async signInPasskey(request: PasskeySignInRequest): Promise<AuthResult<SessionResponse>> {
      const result = await guarded([`device:${request.deviceId}`], () => {
        return [...devices.values()].find((d) => d.credentialId === request.credentialId) ?? null;
      });
      if (!result.ok) return result;
      const account = accounts.get(result.value.accountId) as Account;
      return ok(startSession(account, result.value, request.credentialId));
    },

    // ---- Devices ----

    signOut(token: string): void {
      sessions.delete(token);
    },

    /** The caller's own account devices (admin: the admin's), newest first. */
    devicesOf(caller: Caller): Array<DeviceView> {
      return [...devices.values()]
        .filter((device) => device.accountId === caller.accountId)
        .map((device) => viewOf(device, caller.deviceId))
        .reverse();
    },

    /** False when the device is not on the caller's own account. */
    renameDevice(caller: Caller, deviceId: string, name: string): boolean {
      const device = devices.get(deviceId);
      if (!device || device.accountId !== caller.accountId) return false;
      device.name = name;
      return true;
    },

    revokeOwnDevice(caller: Caller, deviceId: string): boolean {
      const device = devices.get(deviceId);
      if (!device || device.accountId !== caller.accountId) return false;
      dropDevice(deviceId);
      return true;
    },

    /** All devices of a seller and its chefs, for the admin. */
    devicesOfSeller(sellerId: string): Array<DeviceView> {
      return [...devices.values()]
        .filter((device) => accounts.get(device.accountId)?.sellerId === sellerId)
        .map((device) => viewOf(device))
        .reverse();
    },

    revokeSellerDevice(sellerId: string, deviceId: string): boolean {
      const device = devices.get(deviceId);
      if (!device || accounts.get(device.accountId)?.sellerId !== sellerId) return false;
      dropDevice(deviceId);
      return true;
    },

    /** How many devices are registered for one chef (0 when they never signed in). */
    chefDeviceCount(sellerId: string, chefId: string): number {
      const accountId = `chef:${sellerId}:${chefId}`;
      return [...devices.values()].filter((device) => device.accountId === accountId).length;
    },

    /** Signs a chef out everywhere: devices and sessions go, the account and password stay. */
    signOutChef(sellerId: string, chefId: string): number {
      const accountId = `chef:${sellerId}:${chefId}`;
      const own = [...devices.values()].filter((device) => device.accountId === accountId);
      for (const device of own) dropDevice(device.id);
      for (const [token, session] of sessions)
        if (session.accountId === accountId) sessions.delete(token);
      return own.length;
    },

    /** A removed chef loses their account, devices, sessions and open keys. */
    revokeChef(sellerId: string, chefId: string): void {
      dropAccount(`chef:${sellerId}:${chefId}`);
    },

    reset(): void {
      accounts = new Map();
      devices = new Map();
      sessions = new Map();
      keys = [];
      codes = [];
      attempts = new Map();
      counter = 0;
    },

    /** For tests: the stored key hashes and codes' hashes, to prove nothing is kept in plain. */
    dumpSecrets(): string {
      return JSON.stringify({ keys, codes, accounts: [...accounts.values()] });
    },
  };
}

export type AuthStore = ReturnType<typeof createAuthStore>;
