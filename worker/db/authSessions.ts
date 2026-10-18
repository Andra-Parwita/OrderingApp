// Reading a session, and the devices of a person and a kitchen (split out of auth.ts, plan 098 C3; the code is unchanged).
import { SESSION_DAYS, type MembershipRole } from '../../shared/authContract';
import type { AuthRepository, Caller } from '../repo/Repository';
import { sha256Hex } from './crypto';
import {
  MINUTE,
  type AccountRow,
  type DeviceListRow,
  callerRoleOf,
  type AuthHelpers,
} from './authHelpers';

/** Reading a session, and the devices of a person and a kitchen. */
export function sessionsPart(
  h: AuthHelpers,
): Pick<
  AuthRepository,
  | 'resolve'
  | 'me'
  | 'signOut'
  | 'devicesOf'
  | 'renameDevice'
  | 'revokeOwnDevice'
  | 'devicesOfSeller'
  | 'revokeSellerDevice'
  | 'chefDeviceCount'
  | 'signOutChef'
  | 'revokeChef'
> {
  const {
    db,
    now,
    iso,
    getAccount,
    meOf,
    dropDeviceStatements,
    KITCHEN_DEVICE_SELECT,
    viewOf,
    dropOrphanPerson,
  } = h;
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
