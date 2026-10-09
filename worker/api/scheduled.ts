// The Worker's scheduled jobs (wrangler.jsonc `triggers.crons`), run for every seller at once. They
// do not depend on anyone opening a screen.
//   - Hourly: finish every live menu whose cooking day has ended, i.e. at midnight (Melbourne)
//     after it (plan 001, D-069 Q5). Hourly is only the polling step; the menu finishes at the
//     first run after its midnight.
//   - Weekly (Mondays 03:00 UTC): retention (stage 8.4b, D-027 row 6, D-044). Order details of a
//     closed week are dropped 4 weeks after its cooking date; totals stay, and each dropped order
//     leaves a stub so its old link says "archived".
import { Db, type D1Like } from '../db/d1';
import { finishDueMenus } from '../db/menus';
import { dropExpiredDetails, type RetentionCounts } from '../db/retention';

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
  const counts = await dropExpiredDetails(new Db(env.DB), now);
  log(
    `retention: ${String(counts.weeks)} week(s) archived, ${String(counts.orders)} order(s) dropped`,
  );
  return counts;
}

/**
 * Finishes every live menu past the midnight that ends its cooking day: its orders are archived,
 * the ones still open are closed, and the menu becomes finished. Idempotent: a finished menu is
 * skipped, so the hourly run finds nothing to do most of the time. Logs counts only.
 */
export async function runAutoFinish(
  env: { DB: D1Like },
  now: Date,
  log: (line: string) => void = (line) => {
    console.log(line);
  },
): Promise<{ menus: number; orders: number; failed: number }> {
  const counts = await finishDueMenus(new Db(env.DB), now);
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
