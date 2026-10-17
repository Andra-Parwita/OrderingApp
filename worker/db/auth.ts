// Sign-in on D1: accounts, devices, sessions, keys, add-device codes and lockouts (D-011, D-013,
// D-027 row 1), ported from the retired in-memory store (D-047). Keys, codes and session tokens are stored only as
// SHA-256 hashes; passwords as PBKDF2; passkeys as public data (credential id, public key, counter,
// transports). The WebAuthn checks themselves live in worker/auth/webauthn.ts.
import type { ApiErrorCode } from '../../shared/apiError';
import {
  CHALLENGE_TTL_MINUTES,
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
  type Membership,
  type MembershipRole,
  type PasswordSignInRequest,
  type Role,
  type SellerSummary,
  type InviteInfo,
  type TeamMember,
  type TeamName,
} from '../../shared/authContract';
import type {
  AuthFail,
  AuthRepository,
  AuthResult,
  Caller,
  ChallengeBinding,
  RegisterInput,
  SessionGrant,
  StoredPasskey,
} from '../repo/Repository';
import { marks, type D1Statement, type Db } from './d1';
import { ipKey } from '../auth/ipKey';
import { liveMenu } from './orders';
import {
  formatKey,
  fromHex,
  hex,
  normaliseKey,
  pbkdf2Hex,
  PBKDF2_ITERATIONS,
  randomChars,
  randomDigits,
  sha256Hex,
} from './crypto';

const MINUTE = 60_000;

const ok = <T>(value: T): AuthResult<T> => ({ ok: true, value });
const fail = (error: ApiErrorCode, message: string): AuthFail => ({ ok: false, error, message });
const INVALID: AuthFail = fail('invalid_credentials', 'Not valid or expired');

type Via = 'admin-setup' | 'key' | 'code';

type AccountRow = {
  id: string;
  role: 'admin' | 'person';
  display_name: string | null;
  password_salt: string | null;
  password_hash: string | null;
  password_iterations: number | null;
};
type MembershipRow = {
  account_id: string;
  seller_id: string;
  role: MembershipRole;
  chef_id: string | null;
};
/** An owner acts as the seller always did; a chef as a chef (plan 033); a helper as a helper (028). */
const callerRoleOf = (role: MembershipRole): Role =>
  role === 'owner' ? 'seller' : role === 'helper' ? 'helper' : 'chef';
type DeviceRow = {
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

function transportsOf(json: string | null): Array<string> {
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

export function createAuthRepository(deps: AuthDeps): AuthRepository {
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

  type DeviceListRow = DeviceRow & {
    role: 'admin' | 'person';
    m_role: MembershipRole | null;
    chef_id: string | null;
    chef_name: string | null;
  };

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
    // ---- Reading a session ----

    /**
     * The live session for a token, renewed on use (full sessions: 30 days from now). A person's
     * role is read from their membership of the session's kitchen on every call, so a removed
     * member is refused at once.
     */
    async resolve(token) {
      if (!token) return undefined;
      const hash = await sha256Hex(token);
      const row = await db.first<{
        expires_at: string;
        device_id: string | null;
        account_id: string;
        role: 'admin' | 'person';
        seller_id: string | null;
        chef_id: string | null;
        display_name: string | null;
        m_role: MembershipRole | null;
        has_device: number | null;
        paused: string | null;
      }>(
        `SELECT s.expires_at, s.device_id, s.seller_id, a.id AS account_id, a.role, a.display_name, m.chef_id,
           m.role AS m_role, d.id AS has_device, k.paused
         FROM sessions s JOIN accounts a ON a.id = s.account_id
         LEFT JOIN sellers k ON k.id = s.seller_id
         LEFT JOIN devices d ON d.id = s.device_id
         LEFT JOIN memberships m ON m.account_id = a.id AND m.seller_id = s.seller_id
         WHERE s.token_hash = ?`,
        hash,
      );
      if (!row) return undefined;
      if (
        Date.parse(row.expires_at) <= now() ||
        (row.device_id && !row.has_device) ||
        (row.role === 'person' && !row.m_role) ||
        (row.role === 'person' && row.paused === 'full')
      ) {
        await db.stmt('DELETE FROM sessions WHERE token_hash = ?', hash).run();
        return undefined;
      }
      if (row.device_id) {
        await db.batch([
          db.stmt('UPDATE devices SET last_used_at = ? WHERE id = ?', iso(now()), row.device_id),
          db.stmt(
            'UPDATE sessions SET expires_at = ? WHERE token_hash = ?',
            iso(now() + SESSION_DAYS * 24 * 60 * MINUTE),
            hash,
          ),
        ]);
      }
      const caller: Caller = {
        token,
        role: row.role === 'admin' || !row.m_role ? 'admin' : callerRoleOf(row.m_role),
        setup: row.device_id === null,
        accountId: row.account_id,
        ...(row.display_name !== null ? { displayName: row.display_name } : {}),
        ...(row.seller_id !== null ? { sellerId: row.seller_id } : {}),
        ...(row.chef_id !== null ? { chefId: row.chef_id } : {}),
        ...(row.device_id !== null ? { deviceId: row.device_id } : {}),
      };
      return caller;
    },

    async me(caller: Caller) {
      const account = (await getAccount(caller.accountId)) as AccountRow;
      const device = caller.deviceId
        ? await db.first<{ id: string; name: string }>(
            'SELECT id, name FROM devices WHERE id = ?',
            caller.deviceId,
          )
        : null;
      return meOf(account, caller.sellerId ?? null, device ?? undefined, caller.setup);
    },

    // ---- Admin setup and keys ----

    adminExists,

    /** Refused once an admin has a registered device; a wrong key counts toward the lockout. */
    async adminSetup(setupKey: string, deviceId: string) {
      if (await adminExists()) return fail('admin_exists', 'An admin is already set up');
      const result = await guarded([`device:${deviceId}`], () =>
        normaliseKey(setupKey) === normaliseKey(deps.adminSetupKey) ? true : null,
      );
      if (!result.ok) return result;
      return ok(await startSetup(await adminAccount(), null, 'admin-setup'));
    },

    /** Invite (admin for a first owner, owner for an owner or a chef). Shown once. */
    async createKey(target) {
      return makeKey(target);
    },

    /**
     * A key becomes a setup session for a NEW person, or (with `join`) adds the membership to a
     * signed-in person. Wrong, expired, used-up or already used on this browser: one plain error.
     * The key admits one device (D-085).
     */
    async redeemKey(key: string, deviceId: string, options = {}) {
      const hash = await sha256Hex(normaliseKey(key));
      const record = await db.first<{
        expires_at: string;
        seller_id: string;
        role: MembershipRole;
        chef_id: string | null;
        display_name: string;
      }>(
        'SELECT expires_at, seller_id, role, chef_id, display_name FROM auth_keys WHERE key_hash = ?',
        hash,
      );
      const scopes = [`device:${deviceId}`, ...(record ? [`seller:${record.seller_id}`] : [])];
      const spentElsewhere = () => recordFailure(scopes);
      const result = await guarded(scopes, async () => {
        if (!record || Date.parse(record.expires_at) <= now()) return null;
        const used = await db.all<{ client_device_id: string }>(
          'SELECT client_device_id FROM auth_key_redemptions WHERE key_hash = ?',
          hash,
        );
        if (used.length >= KEY_MAX_DEVICES) return null;
        if (used.some((row) => row.client_device_id === deviceId)) return null;
        return record;
      });
      if (!result.ok) return result;
      const invite = result.value;
      if ((await pausedOf(invite.seller_id)) === 'full') return PAUSED;
      const redemption = db.stmt(
        'INSERT INTO auth_key_redemptions (key_hash, client_device_id, redeemed_at) VALUES (?, ?, ?)',
        hash,
        deviceId,
        iso(now()),
      );
      const addMembership = (accountId: string) =>
        db.stmt(
          `INSERT INTO memberships (account_id, seller_id, role, chef_id, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          accountId,
          invite.seller_id,
          invite.role,
          invite.role === 'chef' ? invite.chef_id : null,
          iso(now()),
        );

      const joiner = options.join;
      if (joiner && !joiner.setup && joiner.role !== 'admin') {
        if (await membershipOf(joiner.accountId, invite.seller_id)) {
          return fail('invalid_request', 'You already belong to this kitchen');
        }
        try {
          await db.batch([
            redemption,
            addMembership(joiner.accountId),
            db.stmt(
              'UPDATE sessions SET seller_id = ? WHERE token_hash = ?',
              invite.seller_id,
              await sha256Hex(joiner.token),
            ),
          ]);
        } catch {
          return spentElsewhere(); // lost the race: the key's row already exists
        }
        const account = (await getAccount(joiner.accountId)) as AccountRow;
        const device = joiner.deviceId
          ? await db.first<{ id: string; name: string }>(
              'SELECT id, name FROM devices WHERE id = ?',
              joiner.deviceId,
            )
          : null;
        return ok({
          token: joiner.token,
          me: await meOf(account, invite.seller_id, device ?? undefined, false),
        });
      }

      const id = newPersonId();
      try {
        await db.batch([
          db.stmt(
            `INSERT INTO accounts (id, role, display_name, created_at) VALUES (?, 'person', ?, ?)`,
            id,
            options.displayName ?? invite.display_name,
            iso(now()),
          ),
          addMembership(id),
          redemption,
        ]);
      } catch {
        return spentElsewhere();
      }
      const account = (await getAccount(id)) as AccountRow;
      return ok(await startSetup(account, invite.seller_id, 'key'));
    },

    // ---- Add-device codes ----

    /** From a signed-in device: 6 digits, 10 minutes, one use. */
    async createCode(caller: Caller): Promise<CodeResponse> {
      const taken = async (hash: string) =>
        (await db.first(
          'SELECT 1 AS hit FROM auth_codes WHERE code_hash = ? AND used = 0 AND expires_at > ?',
          hash,
          iso(now()),
        )) !== null;
      let code = randomDigits(CODE_LENGTH);
      let hash = await sha256Hex(code);
      while (await taken(hash)) {
        code = randomDigits(CODE_LENGTH);
        hash = await sha256Hex(code);
      }
      const expiresAt = now() + CODE_TTL_MINUTES * MINUTE;
      await db
        .stmt(
          `INSERT INTO auth_codes (code_hash, account_id, seller_id, created_at, expires_at, used)
           VALUES (?, ?, ?, ?, ?, 0)`,
          hash,
          caller.accountId,
          caller.sellerId ?? null,
          iso(now()),
          iso(expiresAt),
        )
        .run();
      return { code, expiresAt: iso(expiresAt) };
    },

    async redeemCode(code: string, deviceId: string) {
      // A code is 6 digits, so the limit is per kitchen as well as per browser id: a wrong code
      // cannot be tied to a seller, so it counts against every seller with a live code (they all
      // move together, so the whole guess budget is 5 per window, however many ids are used).
      // At 5 the sellers' live codes are invalidated and `locked_out` answers until the lock ends.
      const hash = await sha256Hex(code.replace(/\s/g, ''));
      const device = `device:${deviceId}`;
      const record = await db.first<{ id: number; account_id: string; seller_id: string | null }>(
        'SELECT id, account_id, seller_id FROM auth_codes WHERE code_hash = ? AND used = 0 AND expires_at > ? LIMIT 1',
        hash,
        iso(now()),
      );
      if (record) {
        if ((await pausedOf(record.seller_id)) === 'full') return PAUSED;
        const scope = codeScope(record.seller_id);
        const locked = await lockedSeconds([device, scope]);
        if (locked > 0) return lockedFail(locked);
        // Single use under a race: only the redemption that flips `used` goes ahead.
        const taken = await db.first(
          'UPDATE auth_codes SET used = 1 WHERE id = ? AND used = 0 AND expires_at > ? RETURNING id',
          record.id,
          iso(now()),
        );
        if (!taken) return INVALID;
        await clearFailures([device]);
        const account = (await getAccount(record.account_id)) as AccountRow;
        const session = await newSetupSession(account, record.seller_id, 'code');
        await session.statement.run();
        return ok({
          token: session.token,
          me: await meOf(account, record.seller_id, undefined, true),
        });
      }
      // Wrong, expired or used code. Stale counts (older than a code's life) and ended locks go first.
      await db
        .stmt(
          `DELETE FROM auth_attempts WHERE scope LIKE 'codes:%'
           AND ((locked_until IS NULL AND updated_at <= ?) OR (locked_until IS NOT NULL AND locked_until <= ?))`,
          iso(now() - CODE_TTL_MINUTES * MINUTE),
          iso(now()),
        )
        .run();
      const lockedScopes = (
        await db.all<{ scope: string }>(
          "SELECT scope FROM auth_attempts WHERE scope LIKE 'codes:%' AND locked_until IS NOT NULL",
        )
      ).map((row) => row.scope);
      const locked = await lockedSeconds([device, ...lockedScopes]);
      if (locked > 0) return lockedFail(locked);
      const live = await db.all<{ seller_id: string | null }>(
        'SELECT DISTINCT seller_id FROM auth_codes WHERE used = 0 AND expires_at > ?',
        iso(now()),
      );
      const scopes = [device, ...live.map((row) => codeScope(row.seller_id))];
      const failed = await recordFailure(scopes);
      if (failed.error === 'locked_out') {
        await db
          .stmt(
            `UPDATE auth_codes SET used = 1 WHERE used = 0
             AND 'codes:' || COALESCE(seller_id, 'admin') IN (
               SELECT scope FROM auth_attempts WHERE scope LIKE 'codes:%' AND locked_until IS NOT NULL)`,
          )
          .run();
      }
      return failed;
    },

    // ---- Finishing setup, signing in ----

    /**
     * A setup session becomes a device with a full session. Passkey: the route has already
     * verified it. Password: stored as PBKDF2; not for the admin, and not on an add-device setup
     * when the account already has a password.
     */
    async register(token: string, request: RegisterInput) {
      const hash = await sha256Hex(token);
      const session = await db.first<{
        account_id: string;
        device_id: string | null;
        seller_id: string | null;
        via: Via | null;
        expires_at: string;
      }>(
        'SELECT account_id, device_id, seller_id, via, expires_at FROM sessions WHERE token_hash = ?',
        hash,
      );
      if (!session || Date.parse(session.expires_at) <= now() || session.device_id) {
        return fail('unauthorized', 'Sign in first');
      }
      const account = (await getAccount(session.account_id)) as AccountRow;
      const statements: Array<D1Statement> = [];
      if (request.kind === 'password') {
        if (account.role === 'admin') return fail('invalid_request', 'The admin uses a passkey');
        if (session.via === 'code' && account.password_hash !== null) {
          return fail('password_exists', 'This account already has a password');
        }
        const salt = crypto.getRandomValues(new Uint8Array(16));
        statements.push(
          db.stmt(
            'UPDATE accounts SET password_salt = ?, password_hash = ?, password_iterations = ? WHERE id = ?',
            hex(salt),
            await pbkdf2Hex(request.password, salt, PBKDF2_ITERATIONS),
            PBKDF2_ITERATIONS,
            account.id,
          ),
        );
      }
      const passkey = request.kind === 'passkey' ? request.passkey : undefined;
      if (passkey) {
        const taken = await db.first(
          'SELECT 1 AS hit FROM devices WHERE credential_id = ?',
          passkey.credentialId,
        );
        if (taken) return fail('passkey_exists', 'This passkey is already registered');
      }
      const deviceId = newDeviceId();
      const full = await newDeviceSession(account, session.seller_id, deviceId);
      await db.batch([
        ...statements,
        deviceStatement(account, deviceId, request.deviceName, passkey),
        db.stmt('DELETE FROM sessions WHERE token_hash = ?', hash),
        ...full.statements,
      ]);
      return ok({
        token: full.token,
        me: await meOf(
          account,
          session.seller_id,
          { id: deviceId, name: request.deviceName },
          false,
        ),
        ...(passkey ? { credentialId: passkey.credentialId } : {}),
      });
    },

    /** A person of the kitchen by password. A new device is added; the failure is the same for any cause. */
    async signInPassword(request: PasswordSignInRequest) {
      const seller = await db.first<{ id: string }>(
        'SELECT id FROM sellers WHERE slug = ?',
        request.slug,
      );
      const scopes = [`device:${request.deviceId}`, ...(seller ? [`seller:${seller.id}`] : [])];
      const result = await guarded(scopes, async () => {
        if (!seller) return null;
        const account = await db.first<AccountRow>(
          `SELECT a.* FROM accounts a JOIN memberships m ON m.account_id = a.id
           WHERE a.id = ? AND m.seller_id = ? AND a.role = 'person'`,
          request.accountId,
          seller.id,
        );
        if (!account || !account.password_hash || !account.password_salt) return null;
        const hash = await pbkdf2Hex(
          request.password,
          fromHex(account.password_salt),
          account.password_iterations ?? PBKDF2_ITERATIONS,
        );
        return hash === account.password_hash ? account : null;
      });
      if (!result.ok) return result;
      const sellerId = (seller as { id: string }).id;
      if ((await pausedOf(sellerId)) === 'full') return PAUSED;
      const deviceId = newDeviceId();
      const full = await newDeviceSession(result.value, sellerId, deviceId);
      await db.batch([
        deviceStatement(result.value, deviceId, request.deviceName, undefined),
        ...full.statements,
      ]);
      return ok({
        token: full.token,
        me: await meOf(result.value, sellerId, { id: deviceId, name: request.deviceName }, false),
      });
    },

    /** Passkey sign-in: `verify` checks the signature; the new counter is kept on success. */
    async signInPasskey(clientDeviceId, credentialId, verify, slug) {
      const result = await guarded([`device:${clientDeviceId}`], async () => {
        const row = await db.first<DeviceRow>(
          'SELECT * FROM devices WHERE credential_id = ? AND credential_public_key IS NOT NULL',
          credentialId,
        );
        if (!row?.credential_public_key) return null;
        const account = (await getAccount(row.account_id)) as AccountRow;
        const sellerId = account.role === 'admin' ? null : await activeKitchen(account.id, slug);
        if (account.role === 'person' && sellerId === null) return null;
        const counter = await verify({
          credentialId,
          publicKey: row.credential_public_key,
          counter: row.credential_counter ?? 0,
          transports: transportsOf(row.credential_transports),
        });
        if (counter === null) return null;
        await db
          .stmt('UPDATE devices SET credential_counter = ? WHERE id = ?', counter, row.id)
          .run();
        return { row, account, sellerId };
      });
      if (!result.ok) return result;
      const { row, account, sellerId } = result.value;
      if ((await pausedOf(sellerId)) === 'full') return PAUSED;
      const full = await newDeviceSession(account, sellerId, row.id);
      await db.batch(full.statements);
      return ok({
        token: full.token,
        me: await meOf(account, sellerId, row, false),
        credentialId,
      });
    },

    // ---- Kitchens of a person ----

    async memberships(caller: Caller): Promise<Array<Membership>> {
      const rows = await db.all<{
        seller_id: string;
        slug: string;
        name: string;
        demo: number;
        role: MembershipRole;
        chef_id: string | null;
      }>(
        `SELECT m.seller_id, s.slug, s.name, s.demo, m.role, m.chef_id
         FROM memberships m JOIN sellers s ON s.id = m.seller_id
         WHERE m.account_id = ? ORDER BY m.created_at, m.rowid`,
        caller.accountId,
      );
      return rows.map((row) => ({
        sellerId: row.seller_id,
        slug: row.slug,
        sellerName: row.name,
        role: row.role,
        ...(row.chef_id ? { chefId: row.chef_id } : {}),
        ...(row.demo === 1 ? { demo: true as const } : {}),
      }));
    },

    async switchKitchen(caller: Caller, sellerId: string) {
      if (!(await membershipOf(caller.accountId, sellerId))) return false;
      if ((await pausedOf(sellerId)) === 'full') return false;
      await db
        .stmt(
          'UPDATE sessions SET seller_id = ? WHERE token_hash = ?',
          sellerId,
          await sha256Hex(caller.token),
        )
        .run();
      return true;
    },

    async teamNames(sellerId: string): Promise<Array<TeamName>> {
      const rows = await db.all<{ id: string; display_name: string }>(
        `SELECT a.id, a.display_name FROM accounts a JOIN memberships m ON m.account_id = a.id
         WHERE m.seller_id = ? AND a.password_hash IS NOT NULL ORDER BY m.created_at, m.rowid`,
        sellerId,
      );
      return rows.map((row) => ({ accountId: row.id, displayName: row.display_name }));
    },

    async members(sellerId: string, youAccountId?: string): Promise<Array<TeamMember>> {
      const rows = await db.all<{
        id: string;
        display_name: string;
        role: MembershipRole;
        chef_id: string | null;
        chef_name: string | null;
        created_at: string;
        devices: number;
      }>(
        `SELECT a.id, a.display_name, m.role, m.chef_id, c.name AS chef_name, m.created_at,
           (SELECT COUNT(*) FROM devices d WHERE d.account_id = a.id) AS devices
         FROM memberships m JOIN accounts a ON a.id = m.account_id
         LEFT JOIN chefs c ON c.seller_id = m.seller_id AND c.id = m.chef_id
         WHERE m.seller_id = ? ORDER BY m.created_at, m.rowid`,
        sellerId,
      );
      return rows.map((row) => ({
        accountId: row.id,
        displayName: row.display_name,
        role: row.role,
        ...(row.chef_id ? { chefId: row.chef_id } : {}),
        ...(row.chef_name ? { chefName: row.chef_name } : {}),
        devices: row.devices,
        createdAt: row.created_at,
        ...(row.id === youAccountId ? { you: true as const } : {}),
      }));
    },

    /** The newest invites of one kitchen (plan 043): who, what role, when, and how it ended up. */
    async listInvites(sellerId: string, limit: number): Promise<Array<InviteInfo>> {
      const rows = await db.all<{
        display_name: string;
        role: MembershipRole;
        created_at: string;
        expires_at: string;
        used_at: string | null;
      }>(
        `SELECT k.display_name, k.role, k.created_at, k.expires_at,
           (SELECT MAX(r.redeemed_at) FROM auth_key_redemptions r WHERE r.key_hash = k.key_hash) AS used_at
         FROM auth_keys k WHERE k.seller_id = ?
         ORDER BY k.created_at DESC, k.rowid DESC LIMIT ?`,
        sellerId,
        limit,
      );
      return rows.map((row) => ({
        displayName: row.display_name,
        role: row.role,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        status: row.used_at ? 'used' : Date.parse(row.expires_at) <= now() ? 'expired' : 'waiting',
        ...(row.used_at ? { usedAt: row.used_at } : {}),
      }));
    },

    async removeMember(sellerId: string, accountId: string) {
      if (!(await membershipOf(accountId, sellerId))) return false;
      await db.batch([
        db.stmt('DELETE FROM sessions WHERE account_id = ? AND seller_id = ?', accountId, sellerId),
        db.stmt(
          'DELETE FROM memberships WHERE account_id = ? AND seller_id = ?',
          accountId,
          sellerId,
        ),
        dropOrphanPerson(accountId),
      ]);
      return true;
    },

    // ---- WebAuthn support ----

    async saveChallenge(challenge: string, binding: ChallengeBinding) {
      const sessionHash =
        binding.purpose === 'register' ? await sha256Hex(binding.sessionToken) : null;
      await db.batch([
        db.stmt('DELETE FROM auth_challenges WHERE expires_at <= ?', iso(now())),
        // One open registration challenge per setup session.
        ...(sessionHash
          ? [
              db.stmt(
                "DELETE FROM auth_challenges WHERE purpose = 'register' AND session_hash = ?",
                sessionHash,
              ),
            ]
          : []),
        db.stmt(
          `INSERT INTO auth_challenges (challenge, purpose, session_hash, client_device_id, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          challenge,
          binding.purpose,
          sessionHash,
          binding.purpose === 'authenticate' ? binding.clientDeviceId : null,
          iso(now()),
          iso(now() + CHALLENGE_TTL_MINUTES * MINUTE),
        ),
      ]);
    },

    async takeChallenge(challenge: string, binding: ChallengeBinding) {
      // Deleting is reading: the challenge is gone whatever the answer.
      const row = await db.first<{
        purpose: string;
        session_hash: string | null;
        client_device_id: string | null;
        expires_at: string;
      }>(
        'DELETE FROM auth_challenges WHERE challenge = ? RETURNING purpose, session_hash, client_device_id, expires_at',
        challenge,
      );
      if (!row || Date.parse(row.expires_at) <= now() || row.purpose !== binding.purpose) {
        return false;
      }
      return binding.purpose === 'register'
        ? row.session_hash === (await sha256Hex(binding.sessionToken))
        : row.client_device_id === binding.clientDeviceId;
    },

    async passkeysOfAccount(accountId: string) {
      const rows = await db.all<{ credential_id: string; credential_transports: string | null }>(
        'SELECT credential_id, credential_transports FROM devices WHERE account_id = ? AND credential_id IS NOT NULL',
        accountId,
      );
      return rows.map((row) => ({
        credentialId: row.credential_id,
        transports: transportsOf(row.credential_transports),
      }));
    },

    async passkeyById(credentialId: string) {
      const row = await db.first<{ credential_transports: string | null }>(
        'SELECT credential_transports FROM devices WHERE credential_id = ?',
        credentialId,
      );
      return row
        ? { credentialId, transports: transportsOf(row.credential_transports) }
        : undefined;
    },

    /**
     * D-075: one guess at a lost order. `limits` maps each scope to its own number of wrong tries.
     * Refused while any scope is locked; a null answer is a wrong try (a scope locks at its limit). A hit clears only `clearOnHit`: clearing the client's own
     * scope would let a guesser with one valid order reset it between guesses. Tries older than the
     * lock time are forgotten.
     */
    async guessLimited<T>(
      limits: Record<string, number>,
      clearOnHit: Array<string>,
      attempt: () => Promise<T | null>,
    ): Promise<AuthResult<T>> {
      const scopes = Object.keys(limits);
      await db
        .stmt(
          `DELETE FROM auth_attempts WHERE scope IN (${marks(scopes.length)})
           AND locked_until IS NULL AND updated_at <= ?`,
          ...scopes,
          iso(now() - LOCKOUT_MINUTES * MINUTE),
        )
        .run();
      const locked = await lockedSeconds(scopes);
      if (locked > 0) return lockedFail(locked);
      const value = await attempt();
      if (value === null) return recordFailure(scopes, limits);
      await clearFailures(clearOnHit);
      return ok(value);
    },

    ipKey: (ip: string | null) => ipKey(db, new Date(now()), ip),

    /** Fixed window per scope: the seconds until the window ends when over `max`, else 0. */
    async rateLimit(scope: string, max: number, windowSeconds: number) {
      const windowMs = windowSeconds * 1000;
      const cutoff = iso(now() - windowMs);
      await db
        .stmt(
          `INSERT INTO auth_rate (scope, window_start, hits) VALUES (?, ?, 1)
           ON CONFLICT (scope) DO UPDATE SET
             hits = CASE WHEN window_start <= ? THEN 1 ELSE hits + 1 END,
             window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END`,
          scope,
          iso(now()),
          cutoff,
          cutoff,
        )
        .run();
      const row = await db.first<{ window_start: string; hits: number }>(
        'SELECT window_start, hits FROM auth_rate WHERE scope = ?',
        scope,
      );
      if (!row || row.hits <= max) return 0;
      return Math.ceil((Date.parse(row.window_start) + windowMs - now()) / 1000);
    },

    // ---- Devices ----

    async signOut(token: string) {
      await db.stmt('DELETE FROM sessions WHERE token_hash = ?', await sha256Hex(token)).run();
    },

    /** The caller's own devices (a person's span all their kitchens; admin: the admin's), newest first. */
    async devicesOf(caller: Caller) {
      const rows = await db.all<DeviceListRow>(
        `SELECT d.*, a.role AS role, m.role AS m_role, m.chef_id AS chef_id, c.name AS chef_name
         FROM devices d JOIN accounts a ON a.id = d.account_id
         LEFT JOIN memberships m ON m.account_id = a.id AND m.seller_id = ?
         LEFT JOIN chefs c ON c.seller_id = m.seller_id AND c.id = m.chef_id
         WHERE d.account_id = ? ORDER BY d.rowid DESC`,
        caller.sellerId ?? '',
        caller.accountId,
      );
      return rows.map((row) => viewOf(row, caller.deviceId, caller.role));
    },

    /** False when the device is not on the caller's own account. */
    async renameDevice(caller: Caller, deviceId: string, name: string) {
      const own = await db.first(
        'SELECT 1 AS hit FROM devices WHERE id = ? AND account_id = ?',
        deviceId,
        caller.accountId,
      );
      if (!own) return false;
      await db.stmt('UPDATE devices SET name = ? WHERE id = ?', name, deviceId).run();
      return true;
    },

    async revokeOwnDevice(caller: Caller, deviceId: string) {
      const own = await db.first(
        'SELECT 1 AS hit FROM devices WHERE id = ? AND account_id = ?',
        deviceId,
        caller.accountId,
      );
      if (!own) return false;
      await db.batch(dropDeviceStatements(deviceId));
      return true;
    },

    /** All devices of the people of a kitchen, for the admin. */
    async devicesOfSeller(sellerId: string) {
      const rows = await db.all<DeviceListRow>(
        `${KITCHEN_DEVICE_SELECT} ORDER BY d.rowid DESC`,
        sellerId,
      );
      return rows.map((row) => viewOf(row));
    },

    async revokeSellerDevice(sellerId: string, deviceId: string) {
      const own = await db.first(
        `SELECT 1 AS hit FROM devices d JOIN memberships m ON m.account_id = d.account_id
         WHERE d.id = ? AND m.seller_id = ?`,
        deviceId,
        sellerId,
      );
      if (!own) return false;
      await db.batch(dropDeviceStatements(deviceId));
      return true;
    },

    /** How many devices are registered for people who are this cook (0 when they never signed in). */
    async chefDeviceCount(sellerId: string, chefId: string) {
      const row = await db.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM devices d JOIN memberships m ON m.account_id = d.account_id
         WHERE m.seller_id = ? AND m.chef_id = ?`,
        sellerId,
        chefId,
      );
      return row?.n ?? 0;
    },

    /**
     * Signs a cook out of this kitchen: their sessions here end. Their devices and other kitchens
     * stay (a device is the person's). Removing the member is what shuts the door.
     */
    async signOutChef(sellerId: string, chefId: string) {
      const n = await this.chefDeviceCount(sellerId, chefId);
      await db
        .stmt(
          `DELETE FROM sessions WHERE seller_id = ? AND account_id IN
           (SELECT account_id FROM memberships WHERE seller_id = ? AND chef_id = ?)`,
          sellerId,
          sellerId,
          chefId,
        )
        .run();
      return n;
    },

    /**
     * A removed cook: chef members lose their membership (and sessions) here, owners who also
     * cooked keep theirs without the link, open invites for the cook go.
     */
    async revokeChef(sellerId: string, chefId: string) {
      const chefs = await db.all<{ account_id: string }>(
        "SELECT account_id FROM memberships WHERE seller_id = ? AND chef_id = ? AND role = 'chef'",
        sellerId,
        chefId,
      );
      await db.batch([
        db.stmt(
          `DELETE FROM sessions WHERE seller_id = ? AND account_id IN
           (SELECT account_id FROM memberships WHERE seller_id = ? AND chef_id = ? AND role = 'chef')`,
          sellerId,
          sellerId,
          chefId,
        ),
        db.stmt(
          "DELETE FROM memberships WHERE seller_id = ? AND chef_id = ? AND role = 'chef'",
          sellerId,
          chefId,
        ),
        db.stmt(
          'UPDATE memberships SET chef_id = NULL WHERE seller_id = ? AND chef_id = ?',
          sellerId,
          chefId,
        ),
        db.stmt(
          'DELETE FROM auth_key_redemptions WHERE key_hash IN (SELECT key_hash FROM auth_keys WHERE seller_id = ? AND chef_id = ?)',
          sellerId,
          chefId,
        ),
        db.stmt('DELETE FROM auth_keys WHERE seller_id = ? AND chef_id = ?', sellerId, chefId),
        ...chefs.map((chef) => dropOrphanPerson(chef.account_id)),
      ]);
    },
  };
}

/**
 * Plan 038 stage 3: the admin's one-glance summary per kitchen, from four grouped queries (not one
 * per kitchen). Counts and dates only, no names (D-007). A kitchen with nothing has no entry here.
 */
export async function sellerSummaries(db: Db): Promise<Map<string, SellerSummary>> {
  const [menus, orders, people, active] = await Promise.all([
    db.all<{
      seller_id: string;
      state: 'not_published' | 'live' | 'finished';
      cooking_date: string;
    }>('SELECT seller_id, state, cooking_date FROM menus'),
    db.all<{ seller_id: string; n: number }>(
      `SELECT seller_id, COUNT(*) AS n FROM orders WHERE ${liveMenu('')} AND status <> 'cancelled' GROUP BY seller_id`,
    ),
    db.all<{ seller_id: string; n: number }>(
      'SELECT seller_id, COUNT(*) AS n FROM memberships GROUP BY seller_id',
    ),
    db.all<{ seller_id: string; last: string; devices: number }>(
      'SELECT m.seller_id AS seller_id, MAX(d.last_used_at) AS last, COUNT(d.id) AS devices FROM memberships m JOIN devices d ON d.account_id = m.account_id GROUP BY m.seller_id',
    ),
  ]);
  const byId = <T extends { seller_id: string }>(rows: Array<T>) =>
    new Map(rows.map((row) => [row.seller_id, row]));
  const menuOf = byId(menus);
  const ordersOf = byId(orders);
  const peopleOf = byId(people);
  const activeOf = byId(active);
  const ids = new Set([
    ...menuOf.keys(),
    ...ordersOf.keys(),
    ...peopleOf.keys(),
    ...activeOf.keys(),
  ]);
  const result = new Map<string, SellerSummary>();
  for (const id of ids) {
    const menu = menuOf.get(id);
    result.set(id, {
      people: peopleOf.get(id)?.n ?? 0,
      menu: menu ? { state: menu.state, cookingDate: menu.cooking_date } : null,
      orders: ordersOf.get(id)?.n ?? 0,
      lastActiveAt: activeOf.get(id)?.last ?? null,
      devices: activeOf.get(id)?.devices ?? 0,
    });
  }
  return result;
}
