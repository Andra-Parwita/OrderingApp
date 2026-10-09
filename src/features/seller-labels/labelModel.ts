import type { OrderLine, SellerOrder } from '../../../shared/domain';

export type LabelPaper = 'a4' | 'roll';
export type LabelFilter = 'confirmed' | 'notCancelled' | 'selected';

/** Labels hold a short packing/allergy aid, not the whole note (D-027). */
export const LABEL_NOTE_MAX = 70;
/** A4 sheet of 2 columns by 7 rows. */
export const LABELS_PER_SHEET = 14;

/** The note cut to at most `max` characters in total, ending in an ellipsis when it was cut. */
export function truncateNote(note: string, max: number = LABEL_NOTE_MAX): string {
  const text = note.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** "2× Lemper ayam / Chicken lemper": Indonesian first, then English; one name if they match. */
export function itemText(line: Pick<OrderLine, 'qty' | 'name'>): string {
  const id = line.name.id.trim();
  const en = line.name.en.trim();
  const name = id === '' || en === '' || id === en ? id || en : `${id} / ${en}`;
  return `${String(line.qty)}× ${name}`;
}

export function pickOrders(
  orders: ReadonlyArray<SellerOrder>,
  filter: LabelFilter,
  selected: ReadonlySet<string>,
): Array<SellerOrder> {
  switch (filter) {
    case 'confirmed':
      return orders.filter((order) => order.status === 'confirmed');
    case 'notCancelled':
      return orders.filter((order) => order.status !== 'cancelled');
    case 'selected':
      return orders.filter((order) => selected.has(order.id));
    default: {
      const unreachable: never = filter;
      return unreachable;
    }
  }
}

/** Orders split into pages of `size`, in order. */
export function chunk<T>(list: ReadonlyArray<T>, size: number): Array<Array<T>> {
  const pages: Array<Array<T>> = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages;
}
