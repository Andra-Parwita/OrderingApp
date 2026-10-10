import type { LocalText, SellerOrder } from './domain';
import { ORDER_DETAIL_WEEKS } from './limits';
import { parseOrder } from './orderContract';
import { isInt, isIsoDate, isRecord, parseArray, parseLocalText } from './parse';

const DAY_MS = 86_400_000;

/** What is kept of a closed week for good (D-027 row 6). Cancelled orders are not counted. */
export type WeekTotals = {
  orders: number;
  cancelled: number;
  incomeCents: number;
  paidCents: number;
  unpaidCents: number;
  /** Quantity per item, in first-seen order; names come from the order snapshots. */
  items: Array<{ itemId: string; name: LocalText; qty: number }>;
};

export type PastWeekSummary = {
  id: string;
  /** Local date, YYYY-MM-DD. */
  cookingDate: string;
  closedAt: string;
  totals: WeekTotals;
  /** True while the order details are still kept. */
  hasOrders: boolean;
};

/** `orders` is present only while the week is within ORDER_DETAIL_WEEKS of its cooking date. */
export type PastWeek = Omit<PastWeekSummary, 'hasOrders'> & { orders?: Array<SellerOrder> };

export type PastWeeksResponse = { weeks: Array<PastWeekSummary> };
export type PastWeekResponse = { week: PastWeek };

export function orderTotalCents(order: Pick<SellerOrder, 'lines'>): number {
  return order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
}

export function summariseOrders(orders: ReadonlyArray<SellerOrder>): WeekTotals {
  const totals: WeekTotals = {
    orders: 0,
    cancelled: 0,
    incomeCents: 0,
    paidCents: 0,
    unpaidCents: 0,
    items: [],
  };
  for (const order of orders) {
    if (order.status === 'cancelled') {
      totals.cancelled++;
      continue;
    }
    const cents = orderTotalCents(order);
    totals.orders++;
    totals.incomeCents += cents;
    if (order.paid) totals.paidCents += cents;
    else totals.unpaidCents += cents;
    for (const line of order.lines) {
      const known = totals.items.find((item) => item.itemId === line.itemId);
      if (known) known.qty += line.qty;
      else totals.items.push({ itemId: line.itemId, name: { ...line.name }, qty: line.qty });
    }
  }
  return totals;
}

/** Whether order details are still kept: until the cooking date plus 4 weeks (pure; clock injected). */
export function keepsOrderDetails(cookingDate: string, now: Date): boolean {
  const start = Date.parse(`${cookingDate}T00:00:00Z`);
  return now.getTime() < start + ORDER_DETAIL_WEEKS * 7 * DAY_MS;
}

/** The week with its order details dropped once they are older than 4 weeks; totals stay. */
export function applyRetention(week: PastWeek, now: Date): PastWeek {
  if (week.orders === undefined || keepsOrderDetails(week.cookingDate, now)) return week;
  return {
    id: week.id,
    cookingDate: week.cookingDate,
    closedAt: week.closedAt,
    totals: week.totals,
  };
}

export function toSummary(week: PastWeek): PastWeekSummary {
  const { orders, ...rest } = week;
  return { ...rest, hasOrders: orders !== undefined };
}

/** The same date-and-time text with the date moved by whole days ("2026-10-10" or an ISO instant). */
export function shiftDays(value: string, days: number): string {
  const date = value.slice(0, 10);
  const moved = new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return moved + value.slice(10);
}

function parseTotals(input: unknown): WeekTotals | null {
  if (!isRecord(input)) return null;
  const { orders, cancelled, incomeCents, paidCents, unpaidCents } = input;
  const items = parseArray(input['items'], (item) => {
    if (!isRecord(item)) return null;
    const name = parseLocalText(item['name']);
    const { itemId, qty } = item;
    return typeof itemId === 'string' && name && isInt(qty, 0, 1_000_000)
      ? { itemId, name, qty }
      : null;
  });
  const big = 1_000_000_000;
  if (!items || !isInt(orders, 0, big) || !isInt(cancelled, 0, big)) return null;
  if (!isInt(incomeCents, 0, big) || !isInt(paidCents, 0, big) || !isInt(unpaidCents, 0, big)) {
    return null;
  }
  return { orders, cancelled, incomeCents, paidCents, unpaidCents, items };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseHead(input: Record<string, unknown>) {
  const { id, cookingDate, closedAt } = input;
  const totals = parseTotals(input['totals']);
  if (typeof id !== 'string' || id === '' || typeof cookingDate !== 'string') return null;
  if (!DATE.test(cookingDate) || !isIsoDate(closedAt) || !totals) return null;
  return { id, cookingDate, closedAt, totals };
}

export function parsePastWeekSummary(input: unknown): PastWeekSummary | null {
  if (!isRecord(input)) return null;
  const head = parseHead(input);
  return head && typeof input['hasOrders'] === 'boolean'
    ? { ...head, hasOrders: input['hasOrders'] }
    : null;
}

export function parsePastWeek(input: unknown): PastWeek | null {
  if (!isRecord(input)) return null;
  const head = parseHead(input);
  if (!head) return null;
  if (input['orders'] === undefined) return head;
  const orders = parseArray(input['orders'], parseOrder);
  return orders ? { ...head, orders } : null;
}

export function parsePastWeeksResponse(input: unknown): PastWeeksResponse | null {
  if (!isRecord(input)) return null;
  const weeks = parseArray(input['weeks'], parsePastWeekSummary);
  return weeks ? { weeks } : null;
}

export function parsePastWeekResponse(input: unknown): PastWeekResponse | null {
  if (!isRecord(input)) return null;
  const week = parsePastWeek(input['week']);
  return week ? { week } : null;
}
