// Shared pieces of the sign-in repository: lockouts, accounts, sessions, devices and keys (D-047).
// The method groups live in auth*.ts and are put together by auth.ts.
import type { ApiErrorCode } from '../../shared/apiError';
import {
  KEY_MAX_DEVICES,
  KEY_TTL_HOURS,
  LOCKOUT_MINUTES,
  MAX_FAILED_ATTEMPTS,
  SESSION_DAYS,
  SETUP_SESSION_MINUTES,
  type DeviceView,
  type KeyResponse,
  type Me,
  type MembershipRole,
  type Role,
} from '../../shared/authContract';
import type { AuthFail, AuthResult, SessionGrant, StoredPasskey } from '../repo/Repository';
import { marks, type D1Statement, type Db } from './d1';
import { formatKey, normaliseKey, randomChars, sha256Hex } from './crypto';

export const MINUTE = 60_000;

export const ok = <T>(value: T): AuthResult<T> => ({ ok: true, value });
export const fail = (error: ApiErrorCode, message: string): AuthFail => ({
  ok: false,
  error,
  message,
});
export const INVALID: AuthFail = fail('invalid_credentials', 'Not valid or expired');

export type Via = 'admin-setup' | 'key' | 'code';

export type AccountRow = {
  id: string;
  role: 'admin' | 'person';
  display_name: string | null;
  password_salt: string | null;
  password_hash: string | null;
  password_iterations: number | null;
};
export type MembershipRow = {
  account_id: string;
  seller_id: string;
  role: MembershipRole;
  chef_id: string | null;
};
/** An owner acts as the seller always did; a chef as a chef (plan 033); a helper as a helper (028). */
export const callerRoleOf = (role: MembershipRole): Role =>
  role === 'owner' ? 'seller' : role === 'helper' ? 'helper' : 'chef';
export type DeviceRow = {
  id: string;
  account_id: string;
  name: string;
  credential_id: string | null;
  credential_public_key: string | null;
  credential_counter: number | null;
  credential_transports: string | null;
  created_at: string;
  last_used_at: string;
};

export function transportsOf(json: string | null): Array<string> {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export type AuthDeps = {
  db: Db;
  now: () => Date;
  /** The `ADMIN_SETUP_KEY` secret. */
  adminSetupKey: string;
};

export type DeviceListRow = DeviceRow & {
  role: 'admin' | 'person';
  m_role: MembershipRole | null;
  chef_id: string | null;
  chef_name: string | null;
};

export function createAuthHelpers(deps: AuthDeps) {
  const { db } = deps;
  const now = () => deps.now().getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  const newDeviceId = () => `dev-${randomChars(12).toLowerCase()}`;

  // ---- Lockout (D-027 row 1): 5 failed tries per browser id and per seller, then 15 minutes ----

  type Attempt = { scope: string; fails: number; locked_until: string | null };

  async function lockedSeconds(scopes: ReadonlyArray<string>): Promise<number> {
    const rows = await db.all<Attempt>(
      `SELECT scope, fails, locked_until FROM auth_attempts WHERE scope IN (${marks(scopes.length)})`,
      ...scopes,
    );
    let until = 0;
    const finished: Array<string> = [];
    for (const row of rows) {
      const lockedUntil = row.locked_until === null ? 0 : Date.parse(row.locked_until);
      if (lockedUntil > 0 && lockedUntil <= now()) finished.push(row.scope);
      else until = Math.max(until, lockedUntil);
    }
    if (finished.length > 0) {
      await db
        .stmt(`DELETE FROM auth_attempts WHERE scope IN (${marks(finished.length)})`, ...finished)
        .run();
    }
    return until > now() ? Math.ceil((until - now()) / 1000) : 0;
  }

  const lockedFail = (seconds: number): AuthFail => ({
    ...fail('locked_out', 'Too many tries. Try again later.'),
    retryAfterSeconds: seconds,
  });

  /** The 5th failure locks at once, so it answers `locked_out`; earlier ones say how many are left. */
  async function recordFailure(
    scopes: ReadonlyArray<string>,
    maxFails: number | Record<string, number> = MAX_FAILED_ATTEMPTS,
  ): Promise<AuthFail> {
    const maxOf = (scope: string) =>
      typeof maxFails === 'number' ? maxFails : (maxFails[scope] ?? MAX_FAILED_ATTEMPTS);
    const at = iso(now());
    await db.batch(
      scopes.flatMap((scope) => [
        db.stmt(
          `INSERT INTO auth_attempts (scope, fails, locked_until, updated_at) VALUES (?, 1, NULL, ?)
           ON CONFLICT (scope) DO UPDATE SET fails = fails + 1, updated_at = excluded.updated_at`,
          scope,
          at,
        ),
        db.stmt(
          'UPDATE auth_attempts SET locked_until = ? WHERE scope = ? AND fails >= ?',
          iso(now() + LOCKOUT_MINUTES * MINUTE),
          scope,
          maxOf(scope),
        ),
      ]),
    );
    const rows = await db.all<Attempt>(
      `SELECT scope, fails, locked_until FROM auth_attempts WHERE scope IN (${marks(scopes.length)})`,
      ...scopes,
    );
    const fewest = Math.min(...rows.map((row) => maxOf(row.scope) - row.fails));
    const seconds = await lockedSeconds(scopes);
    if (seconds > 0) return lockedFail(seconds);
    return { ...INVALID, triesLeft: fewest };
  }

  async function clearFailures(scopes: ReadonlyArray<string>): Promise<void> {
    await db
      .stmt(`DELETE FROM auth_attempts WHERE scope IN (${marks(scopes.length)})`, ...scopes)
      .run();
  }

  /** Runs one attempt: refused while locked; a null answer counts as a failed try. */
  async function guarded<T>(
    scopes: Array<string>,
    attempt: () => Promise<T | null> | T | null,
  ): Promise<AuthResult<T>> {
    const locked = await lockedSeconds(scopes);
    if (locked > 0) return lockedFail(locked);
    const value = await attempt();
    if (value === null) return recordFailure(scopes);
    await clearFailures(scopes);
    return ok(value);
  }

  /** The add-device code lockout scope of a kitchen (`admin` for the admin's codes). */
  const codeScope = (sellerId: string | null) => `codes:${sellerId ?? 'admin'}`;

  // ---- Accounts, memberships, sessions and devices ----

  const ADMIN_ID = 'admin';
  const newPersonId = () => `person:${randomChars(14).toLowerCase()}`;

  async function getAccount(id: string): Promise<AccountRow | undefined> {
    return (await db.first<AccountRow>('SELECT * FROM accounts WHERE id = ?', id)) ?? undefined;
  }

  async function adminAccount(): Promise<AccountRow> {
    await db
      .stmt(
        `INSERT OR IGNORE INTO accounts (id, role, created_at) VALUES (?, 'admin', ?)`,
        ADMIN_ID,
        iso(now()),
      )
      .run();
    return (await getAccount(ADMIN_ID)) as AccountRow;
  }

  async function membershipOf(
    accountId: string,
    sellerId: string | null,
  ): Promise<MembershipRow | undefined> {
    if (sellerId === null) return undefined;
    return (
      (await db.first<MembershipRow>(
        'SELECT * FROM memberships WHERE account_id = ? AND seller_id = ?',
        accountId,
        sellerId,
      )) ?? undefined
    );
  }

  /** Plan 032: how a kitchen is paused (null = open). */
  async function pausedOf(sellerId: string | null): Promise<'full' | 'customers' | null> {
    if (sellerId === null) return null;
    const row = await db.first<{ paused: 'full' | 'customers' | null }>(
      'SELECT paused FROM sellers WHERE id = ?',
      sellerId,
    );
    return row?.paused ?? null;
  }
  const PAUSED = fail('kitchen_paused', 'This kitchen is paused. Contact the admin.');

  /** The kitchen a sign-in opens: the asked one if the person belongs to it, else the oldest. */
  async function activeKitchen(
    accountId: string,
    slug: string | undefined,
  ): Promise<string | null> {
    if (slug) {
      const wanted = await db.first<{ seller_id: string }>(
        `SELECT m.seller_id FROM memberships m JOIN sellers s ON s.id = m.seller_id
         WHERE m.account_id = ? AND s.slug = ?`,
        accountId,
        slug,
      );
      if (wanted) return wanted.seller_id;
    }
    const first = await db.first<{ seller_id: string }>(
      `SELECT m.seller_id FROM memberships m JOIN sellers s ON s.id = m.seller_id
       WHERE m.account_id = ? ORDER BY (s.paused = 'full'), m.created_at, m.rowid LIMIT 1`,
      accountId,
    );
    return first?.seller_id ?? null;
  }

  async function meOf(
    account: AccountRow,
    sellerId: string | null,
    device: { id: string; name: string } | undefined,
    setup: boolean,
  ): Promise<Me> {
    const membership = await membershipOf(account.id, sellerId);
    const row = membership
      ? await db.first<{
          id: string;
          slug: string;
          name: string;
          demo: number;
          paused: string | null;
          chef_name: string | null;
        }>(
          `SELECT s.id, s.slug, s.name, s.demo, s.paused, c.name AS chef_name FROM sellers s
           LEFT JOIN chefs c ON c.seller_id = s.id AND c.id = ? WHERE s.id = ?`,
          membership.chef_id,
          membership.seller_id,
        )
      : null;
    // Plan 025: a setup session says what login the account already has (booleans only), so the
    // client can offer it instead of making a second one.
    const hasPasskey = setup
      ? (await db.first(
          'SELECT 1 AS hit FROM devices WHERE account_id = ? AND credential_public_key IS NOT NULL LIMIT 1',
          account.id,
        )) !== null
      : false;
    // Plan 125: the people count lets the tablet show "Switch person" only when there is someone to switch to.
    const people =
      row && !setup
        ? (
            await db.first<{ n: number }>(
              'SELECT COUNT(*) AS n FROM memberships WHERE seller_id = ?',
              row.id,
            )
          )?.n
        : undefined;
    return {
      role:
        account.role === 'admin' ? 'admin' : membership ? callerRoleOf(membership.role) : 'chef',
      stage: setup ? 'setup' : 'full',
      ...(account.display_name !== null ? { displayName: account.display_name } : {}),
      ...(setup ? { hasPassword: account.password_hash !== null, hasPasskey } : {}),
      ...(row ? { sellerId: row.id, slug: row.slug, sellerName: row.name } : {}),
      ...(row?.demo === 1 ? { demo: true as const } : {}),
      ...(row?.paused === 'customers' ? { paused: 'customers' as const } : {}),
      ...(membership?.chef_id ? { chefId: membership.chef_id } : {}),
      ...(row?.chef_name ? { chefName: row.chef_name } : {}),
      ...(device ? { deviceId: device.id, deviceName: device.name } : {}),
      ...(people === undefined ? {} : { people }),
    };
  }

  /** A setup session has no device yet; it may only finish registering. */
  async function newSetupSession(
    account: AccountRow,
    sellerId: string | null,
    via: Via,
  ): Promise<{ token: string; statement: D1Statement }> {
    const token = randomChars(40);
    return {
      token,
      statement: db.stmt(
        `INSERT INTO sessions (token_hash, account_id, device_id, seller_id, via, created_at, expires_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?)`,
        await sha256Hex(token),
        account.id,
        sellerId,
        via,
        iso(now()),
        iso(now() + SETUP_SESSION_MINUTES * MINUTE),
      ),
    };
  }

  async function startSetup(
    account: AccountRow,
    sellerId: string | null,
    via: Via,
  ): Promise<SessionGrant> {
    const session = await newSetupSession(account, sellerId, via);
    await session.statement.run();
    return { token: session.token, me: await meOf(account, sellerId, undefined, true) };
  }

  /** One session per device: signing in again replaces the old token. */
  async function newDeviceSession(
    account: AccountRow,
    sellerId: string | null,
    deviceId: string,
  ): Promise<{ token: string; statements: Array<D1Statement> }> {
    const token = randomChars(40);
    return {
      token,
      statements: [
        db.stmt('DELETE FROM sessions WHERE device_id = ?', deviceId),
        db.stmt('UPDATE devices SET last_used_at = ? WHERE id = ?', iso(now()), deviceId),
        db.stmt(
          `INSERT INTO sessions (token_hash, account_id, device_id, seller_id, via, created_at, expires_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          await sha256Hex(token),
          account.id,
          deviceId,
          sellerId,
          iso(now()),
          iso(now() + SESSION_DAYS * 24 * 60 * MINUTE),
        ),
      ],
    };
  }

  function deviceStatement(
    account: AccountRow,
    id: string,
    name: string,
    passkey: StoredPasskey | undefined,
  ): D1Statement {
    return db.stmt(
      `INSERT INTO devices (id, account_id, name, credential_id, credential_public_key,
         credential_counter, credential_transports, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      account.id,
      name,
      passkey?.credentialId ?? null,
      passkey?.publicKey ?? null,
      passkey?.counter ?? null,
      passkey ? JSON.stringify(passkey.transports) : null,
      iso(now()),
      iso(now()),
    );
  }

  /** Devices go with their sessions; keys and codes stay unless the account goes. */
  function dropDeviceStatements(deviceId: string): Array<D1Statement> {
    return [
      db.stmt('DELETE FROM sessions WHERE device_id = ?', deviceId),
      db.stmt('DELETE FROM devices WHERE id = ?', deviceId),
    ];
  }

  /** Devices of a kitchen's members (the membership gives the role and the cook). */
  const KITCHEN_DEVICE_SELECT = `SELECT d.*, a.role AS role, m.role AS m_role, m.chef_id AS chef_id,
      c.name AS chef_name
    FROM devices d JOIN accounts a ON a.id = d.account_id
    JOIN memberships m ON m.account_id = a.id AND m.seller_id = ?
    LEFT JOIN chefs c ON c.seller_id = m.seller_id AND c.id = m.chef_id`;

  function viewOf(device: DeviceListRow, currentId?: string, ownRole?: Role): DeviceView {
    const role: Role =
      device.role === 'admin' ? 'admin' : (ownRole ?? callerRoleOf(device.m_role ?? 'chef'));
    return {
      id: device.id,
      name: device.name,
      role,
      ...(device.chef_id ? { chefId: device.chef_id } : {}),
      ...(device.chef_name ? { chefName: device.chef_name } : {}),
      createdAt: device.created_at,
      lastUsedAt: device.last_used_at,
      ...(device.id === currentId ? { current: true as const } : {}),
      signIn: device.credential_id ? ('passkey' as const) : ('password' as const),
    };
  }

  async function adminExists(): Promise<boolean> {
    const row = await db.first(
      "SELECT 1 AS hit FROM devices d JOIN accounts a ON a.id = d.account_id WHERE a.role = 'admin' LIMIT 1",
    );
    return row !== null;
  }

  /** A person with no kitchen left has nothing to sign in to: the account goes, with its devices. */
  const dropOrphanPerson = (accountId: string) =>
    db.stmt(
      `DELETE FROM accounts WHERE id = ? AND role = 'person'
       AND NOT EXISTS (SELECT 1 FROM memberships WHERE account_id = ?)`,
      accountId,
      accountId,
    );

  async function makeKey(target: {
    sellerId: string;
    role: MembershipRole;
    chefId?: string;
    displayName: string;
  }): Promise<KeyResponse> {
    const body = randomChars(16);
    const expiresAt = now() + KEY_TTL_HOURS * 60 * MINUTE;
    await db
      .stmt(
        `INSERT INTO auth_keys (key_hash, seller_id, role, chef_id, display_name, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        await sha256Hex(normaliseKey(body)),
        target.sellerId,
        target.role,
        target.role === 'chef' ? (target.chefId ?? null) : null,
        target.displayName,
        iso(now()),
        iso(expiresAt),
      )
      .run();
    return { key: formatKey(body), expiresAt: iso(expiresAt), maxDevices: KEY_MAX_DEVICES };
  }

  return {
    deps,
    db,
    now,
    iso,
    newDeviceId,
    lockedSeconds,
    lockedFail,
    recordFailure,
    clearFailures,
    guarded,
    codeScope,
    ADMIN_ID,
    newPersonId,
    getAccount,
    adminAccount,
    membershipOf,
    pausedOf,
    PAUSED,
    activeKitchen,
    meOf,
    newSetupSession,
    startSetup,
    newDeviceSession,
    deviceStatement,
    dropDeviceStatements,
    KITCHEN_DEVICE_SELECT,
    viewOf,
    adminExists,
    dropOrphanPerson,
    makeKey,
  };
}

export type AuthHelpers = ReturnType<typeof createAuthHelpers>;
