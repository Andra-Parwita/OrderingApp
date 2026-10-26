// Kitchens of a person and the team of a kitchen (split out of auth.ts, plan 098 C3; the code is unchanged).
import {
  type Membership,
  type MembershipRole,
  type InviteInfo,
  type TeamMember,
  type TeamName,
} from '../../shared/authContract';
import type { AuthRepository, Caller } from '../repo/Repository';
import { sha256Hex } from './crypto';
import { type AuthHelpers } from './authHelpers';

/** Kitchens of a person and the team of a kitchen. */
export function teamPart(
  h: AuthHelpers,
): Pick<
  AuthRepository,
  'memberships' | 'switchKitchen' | 'teamNames' | 'members' | 'listInvites' | 'removeMember'
> {
  const { db, now, membershipOf, pausedOf, dropOrphanPerson } = h;
  return {
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
        passkeys: number;
      }>(
        `SELECT a.id, a.display_name, m.role, m.chef_id, c.name AS chef_name, m.created_at,
           (SELECT COUNT(*) FROM devices d WHERE d.account_id = a.id) AS devices,
           (SELECT COUNT(*) FROM devices d WHERE d.account_id = a.id AND d.credential_id IS NOT NULL) AS passkeys
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
        passkeys: row.passkeys,
        ...(row.devices === 0 ? { unfinished: true as const } : {}),
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
  };
}
