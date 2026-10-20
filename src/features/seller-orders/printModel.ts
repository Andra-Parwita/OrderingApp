import type { Language, Order, OrderLine } from '../../../shared/domain';
import type { MenuView } from '../../../shared/menusContract';
import { pickText } from '../../../shared/text';

// Plan 042: what the A4 print of the current menu's orders says. Pure: the screen translates.

export type PrintWhich = 'active' | 'confirmed' | 'selected' | 'everything';
export type PrintSort = 'place' | 'code';
export const PRINT_WHICH: ReadonlyArray<PrintWhich> = [
  'active',
  'confirmed',
  'selected',
  'everything',
];
export const PRINT_SORT: ReadonlyArray<PrintSort> = ['place', 'code'];

export type PrintGroup = Readonly<{
  key: string;
  /** Null for the code-sorted list (one group, no heading). */
  kind: 'pickup' | 'delivery' | 'unknown' | 'all';
  place?: string;
  window?: string;
  orders: ReadonlyArray<Order>;
}>;

export type DishTotal = Readonly<{ itemId: string; name: string; qty: number }>;
export type PrintTotals = Readonly<{
  dishes: ReadonlyArray<DishTotal>;
  orders: number;
  totalCents: number;
  paidCents: number;
  unpaidCents: number;
}>;

export type PrintPlan = Readonly<{ groups: ReadonlyArray<PrintGroup>; totals: PrintTotals }>;

/** Plan 104: Active is every order but the cancelled ones (Done stays); "everything" adds them. */
export function pickPrintOrders(
  orders: ReadonlyArray<Order>,
  which: PrintWhich,
  selected: ReadonlySet<string> = new Set(),
): Array<Order> {
  return orders.filter((order) => {
    switch (which) {
      case 'active':
        return order.status !== 'cancelled';
      case 'confirmed':
        return order.status === 'confirmed';
      case 'selected':
        return selected.has(order.id);
      case 'everything':
        return true;
    }
  });
}

export const lineCents = (order: Order): number =>
  order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);

const byCode = (a: Order, b: Order) => a.code.localeCompare(b.code);

export function buildPrintPlan(
  orders: ReadonlyArray<Order>,
  view: MenuView | null,
  which: PrintWhich,
  sort: PrintSort,
  lang: Language,
  selected: ReadonlySet<string> = new Set(),
): PrintPlan {
  const chosen = pickPrintOrders(orders, which, selected).sort(byCode);
  const points = view?.pickupPoints ?? [];
  const first = points[0]?.id;
  let groups: Array<PrintGroup>;
  if (sort === 'code') {
    groups = chosen.length === 0 ? [] : [{ key: 'all', kind: 'all', orders: chosen }];
  } else {
    groups = [];
    for (const point of points) {
      const list = chosen.filter(
        (o) => o.fulfilment === 'pickup' && (o.pickupPlaceId ?? first) === point.id,
      );
      if (list.length > 0)
        groups.push({
          key: point.id,
          kind: 'pickup',
          place: point.place,
          window: `${point.window.start}–${point.window.end}`,
          orders: list,
        });
    }
    const known = new Set(points.map((p) => p.id));
    const unknown = chosen.filter(
      (o) => o.fulfilment === 'pickup' && !known.has(o.pickupPlaceId ?? first ?? ''),
    );
    if (unknown.length > 0) groups.push({ key: 'unknown', kind: 'unknown', orders: unknown });
    const delivery = chosen.filter((o) => o.fulfilment === 'delivery');
    if (delivery.length > 0) groups.push({ key: 'delivery', kind: 'delivery', orders: delivery });
  }
  return { groups, totals: totalsOf(chosen, lang) };
}

export function totalsOf(orders: ReadonlyArray<Order>, lang: Language): PrintTotals {
  const dishes = new Map<string, DishTotal>();
  let totalCents = 0;
  let paidCents = 0;
  for (const order of orders) {
    const cents = lineCents(order);
    totalCents += cents;
    if (order.paid) paidCents += cents;
    for (const line of order.lines) {
      const now = dishes.get(line.itemId);
      dishes.set(line.itemId, {
        itemId: line.itemId,
        name: dishName(line, lang),
        qty: (now?.qty ?? 0) + line.qty,
      });
    }
  }
  return {
    dishes: [...dishes.values()].sort((a, b) => a.name.localeCompare(b.name)),
    orders: orders.length,
    totalCents,
    paidCents,
    unpaidCents: totalCents - paidCents,
  };
}

export function dishName(line: OrderLine, lang: Language): string {
  return pickText(line.name, lang);
}

/** "2 × Chicken lemper, 1 × Tempe". */
export function itemsLine(order: Order, lang: Language): string {
  return order.lines
    .map((line) => `${line.qty} × ${dishName(line, lang)}${line.note ? ` (${line.note})` : ''}`)
    .join(', ');
}

// ---- Pages ----

export type PrintBlock =
  | Readonly<{ type: 'group'; group: PrintGroup }>
  | Readonly<{ type: 'order'; order: Order; group: PrintGroup }>
  | Readonly<{ type: 'totals' }>;

/** Lines of 10 pt text one page holds (header and margins taken off); kept low so a page never spills. */
export const PAGE_LINES = 40;
const CHARS_PER_LINE = 52;

function orderLines(order: Order, lang: Language): number {
  const text = Math.ceil(itemsLine(order, lang).length / CHARS_PER_LINE);
  const note = order.note ? Math.ceil(order.note.length / CHARS_PER_LINE) : 0;
  return Math.max(1, text) + note + 0.5;
}

/** Splits the plan into pages by line budget. A group heading never ends a page; totals stay together. */
export function paginate(plan: PrintPlan, lang: Language): Array<Array<PrintBlock>> {
  const pages: Array<Array<PrintBlock>> = [[]];
  let used = 0;
  const add = (block: PrintBlock, cost: number, keepWith = 0) => {
    if (used + cost + keepWith > PAGE_LINES && used > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1]?.push(block);
    used += cost;
  };
  for (const group of plan.groups) {
    const nextCost = group.orders[0] ? orderLines(group.orders[0], lang) : 0;
    if (group.kind !== 'all') add({ type: 'group', group }, 2, nextCost);
    for (const order of group.orders) add({ type: 'order', order, group }, orderLines(order, lang));
  }
  // The dish list prints in two columns (PrintOrders), so it costs half a line per dish.
  add({ type: 'totals' }, 6 + Math.ceil(plan.totals.dishes.length / 2));
  return pages;
}
