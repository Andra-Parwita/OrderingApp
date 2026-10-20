import type { Language, LocalText, Order, SellerMenuItemView } from '../../../shared/domain';
import type { EditSellerOrderRequest } from '../../../shared/orderContract';
import { pickText } from '../../../shared/text';

// Plan 105: what the Edit order sheet holds while the seller works, and the request it makes.
// Pure functions; the sheet (EditOrderSheet.tsx) only shows them.

/** One dish of the order being edited. `was` is its count on the saved order (0 for an added dish). */
export type EditRow = Readonly<{
  itemId: string;
  name: LocalText;
  priceCents: number;
  qty: number;
  was: number;
  /** Struck through with Undo until Save; the dish leaves the order on Save. */
  removed: boolean;
  /** Plan 111: the line's note as typed on the sheet, and as saved ('' = none). */
  note?: string;
  wasNote?: string;
}>;

export function initialRows(order: Order): Array<EditRow> {
  return order.lines.map((line) => ({
    itemId: line.itemId,
    name: line.name,
    priceCents: line.priceCents,
    qty: line.qty,
    was: line.qty,
    removed: false,
    note: line.note ?? '',
    wasNote: line.note ?? '',
  }));
}

export function patchRow(
  rows: ReadonlyArray<EditRow>,
  itemId: string,
  patch: Partial<Pick<EditRow, 'qty' | 'removed' | 'note'>>,
): Array<EditRow> {
  return rows.map((row) => (row.itemId === itemId ? { ...row, ...patch } : row));
}

/** Adds one of a menu dish; a dish already in the order (even removed) comes back instead. */
export function addDish(rows: ReadonlyArray<EditRow>, item: SellerMenuItemView): Array<EditRow> {
  if (rows.some((row) => row.itemId === item.id)) {
    return rows.map((row) =>
      row.itemId === item.id ? { ...row, removed: false, qty: Math.max(row.qty, 1) } : row,
    );
  }
  return [
    ...rows,
    {
      itemId: item.id,
      name: item.name,
      priceCents: item.priceCents,
      qty: 1,
      was: 0,
      removed: false,
      note: '',
      wasNote: '',
    },
  ];
}

export const liveRows = (rows: ReadonlyArray<EditRow>): Array<EditRow> =>
  rows.filter((row) => !row.removed && row.qty > 0);

export const rowsTotal = (rows: ReadonlyArray<EditRow>): number =>
  liveRows(rows).reduce((sum, row) => sum + row.priceCents * row.qty, 0);

/**
 * How many portions of a dish this order may hold without going over its limit, or null when it
 * has none. The menu's `remaining` already counts what this order holds (unless it is cancelled).
 */
export function roomFor(
  row: EditRow,
  item: SellerMenuItemView | undefined,
  holds: boolean,
): number | null {
  if (!item) return null;
  const own = holds ? row.was : 0;
  if (item.manualSoldOut === true) return own;
  return item.remaining === null ? null : item.remaining + own;
}

/** "2 × Lalampa" lists of what the seller removed and added, for the summary line. */
export function changeSummary(
  rows: ReadonlyArray<EditRow>,
  lang: Language,
): { removed: Array<string>; added: Array<string> } {
  const text = (row: EditRow, qty: number) => `${String(qty)} × ${pickText(row.name, lang)}`;
  return {
    removed: rows.filter((row) => row.removed && row.was > 0).map((row) => text(row, row.was)),
    added: rows
      .filter((row) => !row.removed && row.was === 0 && row.qty > 0)
      .map((row) => text(row, row.qty)),
  };
}

export type EditValues = Readonly<{
  rows: ReadonlyArray<EditRow>;
  name: string;
  note: string;
}>;

const noteChanged = (row: EditRow): boolean => (row.note ?? '').trim() !== (row.wasNote ?? '');

const linesDiffer = (order: Order, rows: ReadonlyArray<EditRow>): boolean => {
  const next = liveRows(rows);
  return (
    next.length !== order.lines.length ||
    next.some(
      (row) =>
        order.lines.find((line) => line.itemId === row.itemId)?.qty !== row.qty || noteChanged(row),
    )
  );
};

/** True when the sheet differs from the saved order. */
export function isChanged(order: Order, values: EditValues): boolean {
  return (
    linesDiffer(order, values.rows) ||
    values.name.trim() !== order.firstName ||
    values.note.trim() !== (order.note ?? '')
  );
}

/** The request for what changed; the order of lines stays as on the sheet. */
export function buildEditRequest(
  order: Order,
  values: EditValues,
  options: { notify: boolean; force: boolean; reactivate: boolean },
): EditSellerOrderRequest {
  const request: EditSellerOrderRequest = { notify: options.notify };
  if (linesDiffer(order, values.rows)) {
    // A note is sent only when it changed ('' clears it); an absent one keeps the saved note.
    request.lines = liveRows(values.rows).map((row) => ({
      itemId: row.itemId,
      qty: row.qty,
      ...(noteChanged(row) ? { note: (row.note ?? '').trim() } : {}),
    }));
  }
  if (values.name.trim() !== order.firstName) request.firstName = values.name.trim();
  if (values.note.trim() !== (order.note ?? '')) request.note = values.note.trim();
  if (options.force) request.force = true;
  if (options.reactivate) request.reactivate = true;
  return request;
}
