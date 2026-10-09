// Retention (D-027 row 6, D-044): order details of a closed week are dropped 4 weeks after its
// cooking date; the totals stay and a stub (token + date) is left so old links say "archived".
// It runs when a seller opens their history or backup, when a customer looks an order up, and
// once a week for every seller from the Worker's cron (worker/api/scheduled.ts).
import { LOCKOUT_MINUTES } from '../../shared/authContract';
import { keepsOrderDetails } from '../../shared/pastWeeks';
import type { Db } from './d1';

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
  if (expired.length === 0) return { weeks: 0, orders: 0 };
  // One batch per 30 weeks keeps every statement under D1's limit of 100 bound values.
  let orders = 0;
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
