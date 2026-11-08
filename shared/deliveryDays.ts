// Plan 126: delivery on another day. The menu keeps its cooking day (the "event day"); the seller
// ticks the days customers can have delivery on: 2 days before to 1 day after it. Pure helpers shared
// by the Worker and the apps.
import { addDays, formatCookingDate } from './dates';
import type { Language } from './domain';

export const EXTRA_DAYS_MAX = 3;
/** The strip a seller picks from: 2 days before the cooking day, the day itself and 1 day after. */
export const DAYS_BEFORE = 2;
export const DAYS_AFTER = 1;
/** A day further out than this before the cooking day gets the soft warning (never a block). */
export const EXTRA_DAYS_SOFT = 1;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: unknown): value is string {
  return typeof value === 'string' && DATE.test(value) && addDays(value, 0) === value;
}

/** A real date (a chosen delivery day). */
export function isDeliveryDate(value: unknown): value is string {
  return isRealDate(value);
}

/** Absent stays absent; otherwise at most 4 real dates (the range rules are checked with checkDeliveryDays). */
export function parseDeliveryDays(input: unknown): Array<string> | undefined | null {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > EXTRA_DAYS_MAX + 1) return null;
  return input.every((day) => isRealDate(day)) ? input : null;
}

/** Whole days from the cooking day to `day` (negative = before). */
export function dayOffset(cookingDate: string, day: string): number {
  return Math.round(
    (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${cookingDate}T00:00:00Z`)) / 86_400_000,
  );
}

/** The days a seller picks from, in order: 2 before, the cooking day itself and 1 after. */
export function stripDays(cookingDate: string): Array<string> {
  return [-DAYS_BEFORE, -1, 0, DAYS_AFTER].map((offset) => addDays(cookingDate, offset));
}

function inStrip(cookingDate: string, day: string): boolean {
  const offset = dayOffset(cookingDate, day);
  return offset >= -DAYS_BEFORE && offset <= DAYS_AFTER;
}

/** What a menu's delivery days resolve to: the ticked set and the default (the cooking day when none). */
export type DeliveryPlan = { days: Array<string>; defaultDay: string; custom: boolean };

export function deliveryPlan(
  cookingDate: string,
  delivery: { days?: ReadonlyArray<string>; defaultDay?: string } | undefined,
): DeliveryPlan {
  const set = delivery?.days && delivery.days.length > 0 ? [...delivery.days].sort() : [];
  const days = set.length > 0 ? set : [cookingDate];
  const wanted = delivery?.defaultDay ?? cookingDate;
  const defaultDay = days.includes(wanted) ? wanted : (days[0] ?? cookingDate);
  const custom = !(days.length === 1 && days[0] === cookingDate);
  return { days, defaultDay, custom };
}

/**
 * Checks the delivery days a seller sends: real dates, distinct, each 2 days before to 1 day after the
 * cooking day, and the default among them (the cooking day when none is given). Returns the stored
 * form (sorted; empty = only the cooking day), or null if a rule is broken. Delivery off clears them.
 */
export function checkDeliveryDays(
  cookingDate: string,
  days: ReadonlyArray<string>,
  defaultDay: string | undefined,
  deliveryOn: boolean,
): { days: Array<string>; defaultDay?: string } | null {
  if (!deliveryOn) return { days: [] };
  if (days.length === 0) {
    return defaultDay === undefined || defaultDay === cookingDate ? { days: [] } : null;
  }
  if (new Set(days).size !== days.length) return null;
  if (!days.every((day) => isRealDate(day) && inStrip(cookingDate, day))) return null;
  const chosen = defaultDay ?? cookingDate;
  if (!days.includes(chosen)) return null;
  const sorted = [...days].sort();
  if (sorted.length === 1 && sorted[0] === cookingDate) return { days: [] };
  return { days: sorted, ...(chosen !== cookingDate ? { defaultDay: chosen } : {}) };
}

/** When the cooking day moves: keep the stored days still in the strip, and a default still among them. */
export function keepInRange(
  cookingDate: string,
  days: ReadonlyArray<string>,
  defaultDay: string | undefined,
): { days: Array<string>; defaultDay?: string } {
  const kept = days.filter((day) => inStrip(cookingDate, day)).sort();
  const first = kept[0];
  if (first === undefined) return { days: [] };
  if (defaultDay !== undefined && defaultDay !== cookingDate && kept.includes(defaultDay)) {
    return { days: kept, defaultDay };
  }
  return { days: kept, ...(kept.includes(cookingDate) ? {} : { defaultDay: first }) };
}

/** The delivery day of an order: its own, else the cooking day. */
export function deliveryDayOf(order: { handoverDate?: string }, cookingDate: string): string {
  return order.handoverDate ?? cookingDate;
}

/**
 * The days as one short list: "Sat 14, Mon 16, Tue 17 Nov" / "Sabtu 14, Senin 16, Selasa 17 Nov".
 * The month shows once per run of days in the same month.
 */
export function formatDayList(days: ReadonlyArray<string>, lang: Language): string {
  const parts = [...days].sort().map((day) => {
    const text = formatCookingDate(day, lang).replace(', ', ' ');
    const cut = text.lastIndexOf(' ');
    return { day, head: text.slice(0, cut), month: text.slice(cut + 1) };
  });
  return parts
    .map((part, index) => {
      const next = parts[index + 1];
      return next && next.month === part.month ? part.head : `${part.head} ${part.month}`;
    })
    .join(', ');
}

/** Reads `days` and `defaultDay` from a delivery object: each absent stays absent; null = malformed. */
export function parseDeliveryExtras(
  delivery: Record<string, unknown>,
): { days?: Array<string>; defaultDay?: string } | null {
  const days = parseDeliveryDays(delivery['days']);
  if (days === null) return null;
  const defaultDay = delivery['defaultDay'];
  if (defaultDay !== undefined && !isRealDate(defaultDay)) return null;
  return {
    ...(days !== undefined ? { days } : {}),
    ...(defaultDay !== undefined ? { defaultDay } : {}),
  };
}

/**
 * Sorts delivery orders by delivery day, earliest first (an order with no day is on the cooking day).
 * Array.sort is stable, so orders on the same day keep the order they had.
 */
export function compareDeliveryDay(
  cookingDate: string | null,
): (a: { handoverDate?: string }, b: { handoverDate?: string }) => number {
  return (a, b) =>
    (a.handoverDate ?? cookingDate ?? '').localeCompare(b.handoverDate ?? cookingDate ?? '');
}
