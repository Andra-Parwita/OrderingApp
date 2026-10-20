// Retention (D-027 row 6, D-044): order details of a closed week are dropped 4 weeks after its
// cooking date; the totals stay and a stub (token + date) is left so old links say "archived".
// It runs when a seller opens their history or backup, when a customer looks an order up, and
// once a week for every seller from the Worker's cron (worker/api/scheduled.ts).
import { LOCKOUT_MINUTES } from '../../shared/authContract';
import { MENU_NOTICE_KEEP_DAYS } from '../../shared/menuNoticeContract';
import { keepsOrderDetails } from '../../shared/pastWeeks';
import type { Db } from './d1';
import { dropExpiredPrivate } from './private';

/** What one run did. Counts only: no tokens, names or notes ever reach a log. */
export type RetentionCounts = { weeks: number; orders: number };

/**
 * Drops the details of every closed week that is past its keep date, for one seller or (without
 * `sellerId`) for all of them. Idempotent: a week is handled once, then `details_dropped_at` is set.
 */
export async function dropExpiredDetails(
  db: Db,
  now: Date,
  sellerId?: string,
): Promise<RetentionCounts> {
  const weeks =
    sellerId === undefined
      ? await db.all<{ seller_id: string; id: string; cooking_date: string }>(
          'SELECT seller_id, id, cooking_date FROM past_weeks WHERE details_dropped_at IS NULL',
        )
      : await db.all<{ seller_id: string; id: string; cooking_date: string }>(
          'SELECT seller_id, id, cooking_date FROM past_weeks WHERE seller_id = ? AND details_dropped_at IS NULL',
          sellerId,
        );
  const expired = weeks.filter((week) => !keepsOrderDetails(week.cooking_date, now));
  // Plan 081: private orders go ORDER_DETAIL_WEEKS after their event date; they count as orders.
  const privateOrders = await dropExpiredPrivate(db, now, sellerId);
  if (expired.length === 0) return { weeks: 0, orders: privateOrders };
  // One batch per 30 weeks keeps every statement under D1's limit of 100 bound values.
  let orders = privateOrders;
  for (let from = 0; from < expired.length; from += 30) {
    const group = expired.slice(from, from + 30);
    const counted = await db.all<{ n: number }>(
      `SELECT COUNT(*) AS n FROM orders WHERE ${group.map(() => '(seller_id = ? AND past_week_id = ?)').join(' OR ')}`,
      ...group.flatMap((week) => [week.seller_id, week.id]),
    );
    orders += counted[0]?.n ?? 0;
    await db.batch(
      group.flatMap((week) => [
        db.stmt(
          `INSERT OR IGNORE INTO expired_orders (token, seller_id, cooking_date)
           SELECT token, seller_id, ? FROM orders WHERE seller_id = ? AND past_week_id = ?`,
          week.cooking_date,
          week.seller_id,
          week.id,
        ),
        // Push subscriptions go with the order (the cascade would too; this does not rely on it).
        db.stmt(
          'DELETE FROM push_subscriptions WHERE seller_id = ? AND order_id IN (SELECT id FROM orders WHERE seller_id = ? AND past_week_id = ?)',
          week.seller_id,
          week.seller_id,
          week.id,
        ),
        db.stmt(
          'DELETE FROM orders WHERE seller_id = ? AND past_week_id = ?',
          week.seller_id,
          week.id,
        ),
        db.stmt(
          'UPDATE past_weeks SET details_dropped_at = ? WHERE seller_id = ? AND id = ?',
          now.toISOString(),
          week.seller_id,
          week.id,
        ),
      ]),
    );
  }
  return { weeks: expired.length, orders };
}

/**
 * D-075: forgets the wrong tries of "find my order" (and so the hashed addresses) once they are
 * older than the lock time and no lock is live. Only `find:` rows: sign-in counts are not touched.
 * Returns how many rows went.
 */
export async function dropStaleFindAttempts(db: Db, now: Date): Promise<number> {
  const rows = await db.all<{ scope: string }>(
    `DELETE FROM auth_attempts WHERE scope LIKE 'find:%' AND updated_at <= ?
     AND (locked_until IS NULL OR locked_until <= ?) RETURNING scope`,
    new Date(now.getTime() - LOCKOUT_MINUTES * 60_000).toISOString(),
    now.toISOString(),
  );
  return rows.length;
}

/**
 * Plan 112 (D-113): new-menu notice phones that have not ordered from the kitchen for 183 days go,
 * and so do the send records of any menu that is no longer the seller's current one.
 * Returns counts only.
 */
export async function dropStaleMenuNotices(
  db: Db,
  now: Date,
): Promise<{ phones: number; sends: number }> {
  const cutoff = new Date(now.getTime() - MENU_NOTICE_KEEP_DAYS * 86_400_000).toISOString();
  const phones = await db.all<{ endpoint: string }>(
    'DELETE FROM menu_notice_subscriptions WHERE last_order_at < ? RETURNING endpoint',
    cutoff,
  );
  const sends = await db.all<{ menu_id: string }>(
    `DELETE FROM menu_notice_sends WHERE NOT EXISTS (
       SELECT 1 FROM menus m WHERE m.seller_id = menu_notice_sends.seller_id
       AND m.id = menu_notice_sends.menu_id) RETURNING menu_id`,
  );
  return { phones: phones.length, sends: sends.length };
}

const AUTH_EXPIRED_KEEP_DAYS = 7;
const AUTH_SWEEP_BATCH = 500;
const AUTH_SWEEP_ROUNDS = 20;

/**
 * Plan 098 C10: deletes invite/recovery keys (with their redemptions) and add-device codes that
 * expired more than 7 days ago, in batches of 500 (at most 20 rounds per run; the next run
 * continues). Live and recently expired rows stay. Returns counts only.
 */
export async function dropExpiredAuthRows(
  db: Db,
  now: Date,
): Promise<{ keys: number; codes: number }> {
  const cutoff = new Date(now.getTime() - AUTH_EXPIRED_KEEP_DAYS * 86_400_000).toISOString();
  let keys = 0;
  let codes = 0;
  for (let round = 0; round < AUTH_SWEEP_ROUNDS; round += 1) {
    const oldKeys = await db.all<{ key_hash: string }>(
      'DELETE FROM auth_keys WHERE key_hash IN (SELECT key_hash FROM auth_keys WHERE expires_at < ? LIMIT ?) RETURNING key_hash',
      cutoff,
      AUTH_SWEEP_BATCH,
    );
    const oldCodes = await db.all<{ id: number }>(
      'DELETE FROM auth_codes WHERE id IN (SELECT id FROM auth_codes WHERE expires_at < ? LIMIT ?) RETURNING id',
      cutoff,
      AUTH_SWEEP_BATCH,
    );
    keys += oldKeys.length;
    codes += oldCodes.length;
    if (oldKeys.length < AUTH_SWEEP_BATCH && oldCodes.length < AUTH_SWEEP_BATCH) break;
  }
  return { keys, codes };
}
