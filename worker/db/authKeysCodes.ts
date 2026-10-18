// Admin setup, keys and add-device codes (split out of auth.ts, plan 098 C3; the code is unchanged).
import {
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  KEY_MAX_DEVICES,
  type CodeResponse,
  type MembershipRole,
} from '../../shared/authContract';
import type { AuthRepository, Caller } from '../repo/Repository';
import { normaliseKey, randomDigits, sha256Hex } from './crypto';
import { MINUTE, ok, fail, INVALID, type AccountRow, type AuthHelpers } from './authHelpers';

/** Admin setup, keys and add-device codes. */
export function keysCodesPart(
  h: AuthHelpers,
): Pick<
  AuthRepository,
  'adminExists' | 'adminSetup' | 'createKey' | 'redeemKey' | 'createCode' | 'redeemCode'
> {
  const {
    deps,
    db,
    now,
    iso,
    lockedSeconds,
    lockedFail,
    recordFailure,
    clearFailures,
    guarded,
    codeScope,
    newPersonId,
    getAccount,
    adminAccount,
    membershipOf,
    pausedOf,
    PAUSED,
    meOf,
    newSetupSession,
    startSetup,
    adminExists,
    makeKey,
  } = h;
  return {
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
  };
}
