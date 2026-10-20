import type { LocalText, Order } from '../../../shared/domain';
import {
  ALL_CHEFS,
  cookGroups,
  cookNotes,
  filterByChef,
  type ChefFilter,
  type CookMenu,
  type CookNote,
  type CookRow,
  type GroupBy,
} from './cookModel';

// Plan 109: the cook list as a printed page. Pure: counted orders in, sections to print out.
// No cooked count on paper; per dish the portions, the pickup/delivery split and how many people.

export type KitchenPrintGroupBy = Extract<GroupBy, 'item' | 'chef'>;

export type KitchenPrintOptions = {
  chef: ChefFilter;
  groupBy: KitchenPrintGroupBy;
  notes: boolean;
  includePrivate: boolean;
  /** Only with Group by Chef: each chef starts a new sheet. */
  pagePerChef: boolean;
};

export const DEFAULT_PRINT_OPTIONS: KitchenPrintOptions = {
  chef: ALL_CHEFS,
  groupBy: 'item',
  notes: false,
  includePrivate: false,
  pagePerChef: false,
};

export type KitchenPrintRow = {
  itemId: string;
  name: LocalText;
  size: LocalText;
  qty: number;
  privateQty: number;
  pickup: number;
  delivery: number;
  /** Distinct orders (customers) the dish is for, as the Cook tab's person count. */
  people: number;
  /** Plan 111: the heading row of a dish with choices (its total, no split). */
  group?: true;
  /** Plan 111: a choice, printed indented under its group row. */
  choice?: true;
  /** Plan 111: notes typed on this row's order lines; only with the "include notes" option. */
  lineNotes?: Array<{ firstName: string; note: string; choice?: LocalText }>;
};

export type KitchenPrintSection = {
  key: string;
  title: string | null;
  rows: Array<KitchenPrintRow>;
  /** Start this section on a new sheet. */
  pageBreak: boolean;
};

export type KitchenPrintPlan = {
  sections: Array<KitchenPrintSection>;
  notes: Array<CookNote>;
};

function printRow(row: CookRow, withNotes: boolean): KitchenPrintRow {
  const pickup = row.who
    .filter((who) => who.fulfilment === 'pickup')
    .reduce((n, w) => n + w.qty, 0);
  return {
    itemId: row.itemId,
    name: row.name,
    size: row.size,
    qty: row.qty,
    privateQty: row.privateQty,
    pickup,
    delivery: row.qty - pickup,
    people: new Set(row.who.map((who) => who.code)).size,
    ...(row.group ? { group: true as const } : {}),
    ...(row.choice ? { choice: true as const } : {}),
    ...(withNotes && row.notes
      ? {
          lineNotes: row.notes.map((note) => ({
            firstName: note.firstName,
            note: note.note,
            ...(row.choice ? { choice: row.name } : {}),
          })),
        }
      : {}),
  };
}

/** `counted` = the Cook tab's counted orders (cancelled already left out). */
export function buildKitchenPrint(
  counted: ReadonlyArray<Order>,
  menu: CookMenu | null,
  options: KitchenPrintOptions,
): KitchenPrintPlan {
  const used = options.includePrivate ? counted : counted.filter((order) => !order.private);
  const own = filterByChef(used, menu, options.chef);
  const groups = cookGroups(own, menu, options.groupBy);
  const breaks = options.groupBy === 'chef' && options.pagePerChef;
  return {
    sections: groups.map((group, index) => ({
      key: group.key,
      title: group.title,
      rows: group.rows.map((row) => printRow(row, options.notes)),
      pageBreak: breaks && index > 0,
    })),
    notes: options.notes ? cookNotes(own) : [],
  };
}
