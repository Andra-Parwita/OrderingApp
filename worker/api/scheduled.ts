// The weekly cron (stage 8.4b, wrangler.jsonc `triggers.crons`): retention for every seller at once
// (D-027 row 6, D-044). Order details of a closed week are dropped 4 weeks after its cooking date;
// totals stay, and each dropped order leaves a stub so its old link says "archived". It does not
// depend on anyone opening a screen, so storage shrinks even for a kitchen nobody visits.
import { Db, type D1Like } from '../db/d1';
import { dropExpiredDetails, type RetentionCounts } from '../db/retention';

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
