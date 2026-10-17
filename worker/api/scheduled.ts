// The Worker's scheduled jobs (wrangler.jsonc `triggers.crons`), run for every seller at once. They
// do not depend on anyone opening a screen.
//   - Hourly: finish every live menu whose cooking day has ended, i.e. at midnight in the kitchen's own zone
//     after it (plan 001, D-069 Q5). Hourly is only the polling step; the menu finishes at the
//     first run after its midnight.
//   - Weekly (Mondays 03:00 UTC): retention (stage 8.4b, D-027 row 6, D-044). Order details of a
//     closed week are dropped 4 weeks after its cooking date; totals stay, and each dropped order
//     leaves a stub so its old link says "archived". The day-sales log (plan 029) is cut to 10 weeks.
import { dropOldIpSalts } from '../auth/ipKey';
import { wipeOldAddresses } from '../db/address';
import { sweepCustomerHourly, sweepCustomerWeekly } from '../db/customerAuth';
import { Db, type D1Like } from '../db/d1';
import { dropOldDaySales } from '../db/daySales';
import { deleteUnusedPictures, finishDueMenus } from '../db/menus';
import type { ImageBucket } from '../images/r2';
import { dropExpiredDetails, dropStaleFindAttempts, type RetentionCounts } from '../db/retention';

/** Hourly: forgets old wrong tries of "find my order" (D-075). Returns how many rows went. */
export async function runAttemptSweep(env: { DB: D1Like }, now: Date): Promise<number> {
  const db = new Db(env.DB);
  await dropOldIpSalts(db, now);
  return dropStaleFindAttempts(db, now);
}

/** Hourly (plan 071): wipes delivery addresses a day after their menu finished. Returns a count only. */
export function runAddressSweep(env: { DB: D1Like }, now: Date): Promise<number> {
  return wipeOldAddresses(new Db(env.DB), now);
}

/**
 * Hourly (plan 087): sealed customer addresses with no order for 30 days, and expired customer
 * sessions, challenges and codes. Returns how many addresses went (a count only).
 */
export async function runCustomerSweep(env: { DB: D1Like }, now: Date): Promise<number> {
  return (await sweepCustomerHourly(new Db(env.DB), now)).addresses;
}

/** The cron entry (in wrangler.jsonc) that runs retention. The hourly entry only finishes menus. */
export const RETENTION_CRON = '0 3 * * 1';

/**
 * Runs retention and logs one line of counts. Idempotent: a second run right after finds nothing.
 * The log never carries a name, note, token or order code, only how many weeks and orders.
 */
export async function runRetention(
  env: { DB: D1Like },
  now: Date,
  log: (line: string) => void = (line) => {
    console.log(line);
  },
): Promise<RetentionCounts> {
  const db = new Db(env.DB);
  const counts = await dropExpiredDetails(db, now);
  log(
    `retention: ${String(counts.weeks)} week(s) archived, ${String(counts.orders)} order(s) dropped`,
  );
  // Plan 087: Remember me unused for 12 months, and order links whose details are gone.
  const customers = await sweepCustomerWeekly(db, now);
  if (customers.accounts > 0 || customers.links > 0) {
    log(
      `retention: ${String(customers.accounts)} Remember me account(s), ${String(customers.links)} link(s) dropped`,
    );
  }
  // Plan 029: the day-sales log is kept 10 weeks per kitchen.
  const sales = await dropOldDaySales(db, now);
  if (sales > 0) log(`retention: ${String(sales)} day-sales row(s) dropped`);
  return counts;
}

/**
 * Finishes every live menu past the midnight that ends its cooking day: its orders are archived,
 * the ones still open are closed, and the menu becomes finished. Idempotent: a finished menu is
 * skipped, so the hourly run finds nothing to do most of the time. Logs counts only.
 */
export async function runAutoFinish(
  env: { DB: D1Like; IMAGES?: ImageBucket },
  now: Date,
  log: (line: string) => void = (line) => {
    console.log(line);
  },
): Promise<{ menus: number; orders: number; failed: number }> {
  const db = new Db(env.DB);
  const { pruned, ...counts } = await finishDueMenus(db, now);
  // Plan 064: the pictures of past menus beyond the newest 10 (the file goes unless still used).
  if (env.IMAGES) {
    for (const { sellerId, refs } of pruned) {
      try {
        await deleteUnusedPictures(db, env.IMAGES, sellerId, refs);
      } catch {
        // The row is already cleared; a file that stays is only a few hundred KB.
      }
    }
  }
  if (counts.menus > 0) {
    log(
      `auto-finish: ${String(counts.menus)} menu(s) finished, ${String(counts.orders)} open order(s) closed`,
    );
  }
  if (counts.failed > 0) {
    log(`auto-finish: ${String(counts.failed)} menu(s) failed, retried at the next run`);
  }
  return counts;
}
