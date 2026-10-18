// Sign-in on D1: accounts, devices, sessions, keys, add-device codes and lockouts (D-011, D-013,
// D-027 row 1), ported from the retired in-memory store (D-047). Keys, codes and session tokens are stored only as
// SHA-256 hashes; passwords as PBKDF2; passkeys as public data (credential id, public key, counter,
// transports). The WebAuthn checks themselves live in worker/auth/webauthn.ts.
import { type SellerSummary } from '../../shared/authContract';
import type { AuthRepository } from '../repo/Repository';
import { type Db } from './d1';
import { liveMenu } from './orders';
import { createAuthHelpers, type AuthDeps } from './authHelpers';
import { sessionsPart } from './authSessions';
import { keysCodesPart } from './authKeysCodes';
import { signInPart } from './authSignIn';
import { teamPart } from './authTeam';
import { passkeysPart } from './authPasskeys';
import { limitsPart } from './authLimits';

export type { AuthDeps } from './authHelpers';

export function createAuthRepository(deps: AuthDeps): AuthRepository {
  const h = createAuthHelpers(deps);
  return {
    ...sessionsPart(h),
    ...keysCodesPart(h),
    ...signInPart(h),
    ...teamPart(h),
    ...passkeysPart(h),
    ...limitsPart(h),
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
