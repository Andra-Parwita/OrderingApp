// Plan 029 stage 5: the end-of-day summary, worked out from the menu, the orders and the log.
// Pure, so the totals are tested without a screen.
import type { SellerMenuItemView, SellerOrder } from '../../../shared/domain';
import type { DaySaleEntry } from '../../../shared/daySalesContract';

export type DishSummary = {
  itemId: string;
  /** Portions pre-ordered (orders not cancelled). */
  preordered: number;
  /** Portions sold at the stall (sales not undone). */
  soldOnDay: number;
  /** The day stock left now. */
  left: number;
};
export type PersonSummary = { name: string; portions: number };

/** A sale counts unless it was undone; counts and undo rows are corrections of the stock, not sales. */
const isLiveSale = (entry: DaySaleEntry) => entry.kind === 'sale' && !entry.undone;

export function summarise(
  items: ReadonlyArray<SellerMenuItemView>,
  orders: ReadonlyArray<SellerOrder>,
  entries: ReadonlyArray<DaySaleEntry>,
): { dishes: Array<DishSummary>; people: Array<PersonSummary>; totalSold: number } {
  const dishes = items
    .filter((item) => item.dayStock !== undefined || entries.some((e) => e.itemId === item.id))
    .map((item) => ({
      itemId: item.id,
      preordered: orders
        .filter((order) => order.status !== 'cancelled')
        .reduce(
          (sum, order) =>
            sum +
            order.lines.filter((line) => line.itemId === item.id).reduce((n, l) => n + l.qty, 0),
          0,
        ),
      soldOnDay: entries
        .filter((entry) => entry.itemId === item.id && isLiveSale(entry))
        .reduce((sum, entry) => sum - entry.change, 0),
      left: item.dayStock ?? 0,
    }));
  const byPerson = new Map<string, number>();
  for (const entry of entries.filter(isLiveSale)) {
    byPerson.set(entry.by, (byPerson.get(entry.by) ?? 0) - entry.change);
  }
  const people = [...byPerson].map(([name, portions]) => ({ name, portions }));
  return { dishes, people, totalSold: dishes.reduce((sum, d) => sum + d.soldOnDay, 0) };
}
