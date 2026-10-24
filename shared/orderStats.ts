// Plan 121 part B: anonymous order statistics. Four facts a customer's phone sends with an order,
// only to be counted in the admin app (never per order, never per person, never shown to a kitchen).
// No names, ids or free text exist here: every value comes from a short fixed list.
import { isOneOf, isRecord } from './parse';

export const STAT_PLACES = ['app', 'browser', 'inapp'] as const;
export const STAT_SYSTEMS = ['ios', 'android', 'other'] as const;

/** Where the order was placed: the installed app, a browser, or the WhatsApp (or other in-app) browser. */
export type StatPlace = (typeof STAT_PLACES)[number];
export type StatSystem = (typeof STAT_SYSTEMS)[number];

/** Each fact is optional: a phone that cannot tell leaves it out (stored as unknown). */
export type OrderStats = {
  place?: StatPlace;
  os?: StatSystem;
  /** Notifications are on for this order. */
  push?: boolean;
  /** Remember me is on. */
  remember?: boolean;
};

/**
 * Keeps the valid facts and drops everything else, including a `stats` that is not an object. It
 * never refuses: a bad `stats` must not cost a sale (lesson 36). Undefined when nothing is left.
 */
export function parseOrderStats(input: unknown): OrderStats | undefined {
  if (!isRecord(input)) return undefined;
  const { place, os, push, remember } = input;
  const stats: OrderStats = {
    ...(isOneOf(STAT_PLACES, place) ? { place } : {}),
    ...(isOneOf(STAT_SYSTEMS, os) ? { os } : {}),
    ...(typeof push === 'boolean' ? { push } : {}),
    ...(typeof remember === 'boolean' ? { remember } : {}),
  };
  return Object.keys(stats).length > 0 ? stats : undefined;
}

/** How many orders said each thing in one week; `unknown` is the orders that said nothing. */
export type StatCounts<K extends string> = Record<K | 'unknown', number>;

export type StatsWeek = {
  /** The Monday of the week, YYYY-MM-DD (UTC, from the order's creation time). */
  week: string;
  orders: number;
  place: StatCounts<StatPlace>;
  os: StatCounts<StatSystem>;
  push: StatCounts<'on' | 'off'>;
  remember: StatCounts<'on' | 'off'>;
};

export type StatsKitchen = {
  sellerId: string;
  name: string;
  slug: string;
  weeks: Array<StatsWeek>;
};

/** GET /api/admin/stats: counts per kitchen and week, newest week first. Sample orders are left out. */
export type StatsResponse = { kitchens: Array<StatsKitchen> };

/** How many weeks the admin card looks back. */
export const STATS_WEEKS = 8;

const COUNT_KEYS = {
  place: [...STAT_PLACES, 'unknown'],
  os: [...STAT_SYSTEMS, 'unknown'],
  push: ['on', 'off', 'unknown'],
  remember: ['on', 'off', 'unknown'],
} as const;

function parseCounts(input: unknown, keys: ReadonlyArray<string>): Record<string, number> | null {
  if (!isRecord(input)) return null;
  const out: Record<string, number> = {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
    out[key] = value;
  }
  return out;
}

export function parseStatsResponse(input: unknown): StatsResponse | null {
  if (!isRecord(input) || !Array.isArray(input['kitchens'])) return null;
  const kitchens: Array<StatsKitchen> = [];
  for (const raw of input['kitchens'] as Array<unknown>) {
    if (!isRecord(raw) || !Array.isArray(raw['weeks'])) return null;
    const { sellerId, name, slug } = raw;
    if (typeof sellerId !== 'string' || typeof name !== 'string' || typeof slug !== 'string') {
      return null;
    }
    const weeks: Array<StatsWeek> = [];
    for (const w of raw['weeks'] as Array<unknown>) {
      if (!isRecord(w) || typeof w['week'] !== 'string') return null;
      const orders = w['orders'];
      const place = parseCounts(w['place'], COUNT_KEYS.place);
      const os = parseCounts(w['os'], COUNT_KEYS.os);
      const push = parseCounts(w['push'], COUNT_KEYS.push);
      const remember = parseCounts(w['remember'], COUNT_KEYS.remember);
      if (typeof orders !== 'number' || !place || !os || !push || !remember) return null;
      weeks.push({
        week: w['week'],
        orders,
        place: place as StatsWeek['place'],
        os: os as StatsWeek['os'],
        push: push as StatsWeek['push'],
        remember: remember as StatsWeek['remember'],
      });
    }
    kitchens.push({ sellerId, name, slug, weeks });
  }
  return { kitchens };
}
