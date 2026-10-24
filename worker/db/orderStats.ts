// Plan 121 B: the admin's anonymous order counts. One grouped query: per kitchen and week (the
// Monday of the order's creation time), how many orders said each fact. Counts only: no order, name,
// code or token is read or returned. Sample orders, private orders and orders a team member entered
// are left out (they were not placed from a customer's phone).
import { STATS_WEEKS, type StatsKitchen, type StatsResponse } from '../../shared/orderStats';
import type { Db } from './d1';

const DAY_MS = 86_400_000;

type Row = {
  seller_id: string;
  week: string;
  orders: number;
  place_app: number;
  place_browser: number;
  place_inapp: number;
  os_ios: number;
  os_android: number;
  os_other: number;
  push_on: number;
  push_off: number;
  remember_on: number;
  remember_off: number;
};

/** The Monday (UTC) of the week `weeks - 1` weeks before the week of `now`, as an ISO time. */
export function statsSince(now: Date, weeks = STATS_WEEKS): string {
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - day * DAY_MS;
  return new Date(monday - (weeks - 1) * 7 * DAY_MS).toISOString();
}

const count = (column: string, value: string) =>
  `SUM(CASE WHEN ${column} = ${value} THEN 1 ELSE 0 END)`;

export async function readOrderStats(db: Db, now: Date): Promise<StatsResponse> {
  const [sellers, rows] = await Promise.all([
    db.all<{ id: string; slug: string; name: string }>(
      'SELECT id, slug, name FROM sellers ORDER BY rowid',
    ),
    db.all<Row>(
      `SELECT seller_id,
         strftime('%Y-%m-%d', created_at, 'weekday 0', '-6 days') AS week,
         COUNT(*) AS orders,
         ${count('src_place', "'app'")} AS place_app,
         ${count('src_place', "'browser'")} AS place_browser,
         ${count('src_place', "'inapp'")} AS place_inapp,
         ${count('src_os', "'ios'")} AS os_ios,
         ${count('src_os', "'android'")} AS os_android,
         ${count('src_os', "'other'")} AS os_other,
         ${count('src_push', '1')} AS push_on,
         ${count('src_push', '0')} AS push_off,
         ${count('src_remember', '1')} AS remember_on,
         ${count('src_remember', '0')} AS remember_off
       FROM orders
       WHERE kind = 'menu' AND sample = 0 AND entered_by_role IS NULL AND created_at >= ?
       GROUP BY seller_id, week`,
      statsSince(now),
    ),
  ]);
  const kitchens: Array<StatsKitchen> = sellers.map((seller) => ({
    sellerId: seller.id,
    name: seller.name,
    slug: seller.slug,
    weeks: rows
      .filter((row) => row.seller_id === seller.id)
      .sort((a, b) => (a.week < b.week ? 1 : -1))
      .map((r) => ({
        week: r.week,
        orders: r.orders,
        place: {
          app: r.place_app,
          browser: r.place_browser,
          inapp: r.place_inapp,
          unknown: r.orders - r.place_app - r.place_browser - r.place_inapp,
        },
        os: {
          ios: r.os_ios,
          android: r.os_android,
          other: r.os_other,
          unknown: r.orders - r.os_ios - r.os_android - r.os_other,
        },
        push: { on: r.push_on, off: r.push_off, unknown: r.orders - r.push_on - r.push_off },
        remember: {
          on: r.remember_on,
          off: r.remember_off,
          unknown: r.orders - r.remember_on - r.remember_off,
        },
      })),
  }));
  return { kitchens };
}
