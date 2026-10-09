// Retention (D-027 row 6, D-044): order details of a closed week are dropped 4 weeks after its
// cooking date; the totals stay and a stub (token + date) is left so old links say "archived".
import { keepsOrderDetails } from '../../shared/pastWeeks';
import type { Db } from './d1';

/** Drops the details of every closed week of one seller that is past its keep date. Idempotent. */
export async function dropExpiredDetails(db: Db, sellerId: string, now: Date): Promise<void> {
  const weeks = await db.all<{ id: string; cooking_date: string }>(
    'SELECT id, cooking_date FROM past_weeks WHERE seller_id = ? AND details_dropped_at IS NULL',
    sellerId,
  );
  const expired = weeks.filter((week) => !keepsOrderDetails(week.cooking_date, now));
  if (expired.length === 0) return;
  await db.batch(
    expired.flatMap((week) => [
      db.stmt(
        `INSERT OR IGNORE INTO expired_orders (token, seller_id, cooking_date)
         SELECT token, seller_id, ? FROM orders WHERE seller_id = ? AND past_week_id = ?`,
        week.cooking_date,
        sellerId,
        week.id,
      ),
      db.stmt('DELETE FROM orders WHERE seller_id = ? AND past_week_id = ?', sellerId, week.id),
      db.stmt(
        'UPDATE past_weeks SET details_dropped_at = ? WHERE seller_id = ? AND id = ?',
        now.toISOString(),
        sellerId,
        week.id,
      ),
    ]),
  );
}
