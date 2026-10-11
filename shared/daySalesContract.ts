// Plan 029 stage 2: selling on the day. A dish may have a day stock (portions sold at the stall);
// owners and helpers record sales, and every change is a row of the day's log. Pre-orders never
// take from this stock, and customers never see the count (only "available on the day" / "sold out").
import { isInt, isIsoDate, isOneOf, isRecord } from './parse';

export const DAY_STOCK_MAX = 9999;
/** The sales log is kept this many weeks per kitchen (plan 029, builder "A"). */
export const DAY_SALES_KEEP_WEEKS = 10;
const ID_MAX = 64;

/** POST /api/seller/day/sale: take `qty` portions off the day stock (one atomic step). */
export type DaySaleRequest = { itemId: string; qty: number };
/** POST /api/seller/day/count: "Set count", the stock becomes `count`; the difference is logged. */
export type DayCountRequest = { itemId: string; count: number };
/** The answer to both: the stock left, so the screen needs no second call. */
export type DayStockResponse = {
  itemId: string;
  dayStock: number;
  /** The log row a sale or an undo wrote (a sale's id is what Undo needs). */
  entryId?: string;
};
/** POST /api/seller/day/undo: reverses one sale. */
export type DayUndoRequest = { entryId: string };
/** A helper may undo their own sale this long after it; the owner may undo any sale, any time. */
export const DAY_UNDO_WINDOW_MS = 30_000;

export type DaySaleKind = 'sale' | 'count' | 'undo';
export type DaySaleEntry = {
  id: string;
  menuId: string;
  itemId: string;
  kind: DaySaleKind;
  /** Negative for a sale; the difference for a set count. */
  change: number;
  stockAfter: number;
  /** The person's name at the time. */
  by: string;
  at: string;
  undone: boolean;
};
/** GET /api/seller/day/log: the current menu's log, newest first. */
export type DayLogResponse = { entries: Array<DaySaleEntry> };

function parseItemId(value: unknown): string | null {
  return typeof value === 'string' && value !== '' && value.length <= ID_MAX ? value : null;
}

export function parseDaySaleRequest(input: unknown): DaySaleRequest | null {
  if (!isRecord(input)) return null;
  const itemId = parseItemId(input['itemId']);
  return itemId && isInt(input['qty'], 1, DAY_STOCK_MAX) ? { itemId, qty: input['qty'] } : null;
}

export function parseDayUndoRequest(input: unknown): DayUndoRequest | null {
  if (!isRecord(input)) return null;
  const entryId = parseItemId(input['entryId']);
  return entryId ? { entryId } : null;
}

export function parseDayCountRequest(input: unknown): DayCountRequest | null {
  if (!isRecord(input)) return null;
  const itemId = parseItemId(input['itemId']);
  return itemId && isInt(input['count'], 0, DAY_STOCK_MAX)
    ? { itemId, count: input['count'] }
    : null;
}

export function parseDayStockResponse(input: unknown): DayStockResponse | null {
  if (!isRecord(input)) return null;
  const itemId = parseItemId(input['itemId']);
  const entryId = input['entryId'];
  if (entryId !== undefined && (typeof entryId !== 'string' || entryId === '')) return null;
  return itemId && isInt(input['dayStock'], 0, DAY_STOCK_MAX)
    ? { itemId, dayStock: input['dayStock'], ...(entryId !== undefined ? { entryId } : {}) }
    : null;
}

function parseEntry(input: unknown): DaySaleEntry | null {
  if (!isRecord(input)) return null;
  const { id, menuId, itemId, kind, change, stockAfter, by, at, undone } = input;
  if (typeof id !== 'string' || typeof menuId !== 'string' || typeof itemId !== 'string') {
    return null;
  }
  if (
    !isOneOf(['sale', 'count', 'undo'], kind) ||
    typeof by !== 'string' ||
    typeof undone !== 'boolean'
  ) {
    return null;
  }
  if (!isInt(change, -DAY_STOCK_MAX, DAY_STOCK_MAX) || !isInt(stockAfter, 0, DAY_STOCK_MAX)) {
    return null;
  }
  if (!isIsoDate(at)) return null;
  return { id, menuId, itemId, kind, change, stockAfter, by, at, undone };
}

export function parseDayLogResponse(input: unknown): DayLogResponse | null {
  if (!isRecord(input) || !Array.isArray(input['entries'])) return null;
  const entries: Array<DaySaleEntry> = [];
  for (const raw of input['entries'] as Array<unknown>) {
    const entry = parseEntry(raw);
    if (!entry) return null;
    entries.push(entry);
  }
  return { entries };
}
