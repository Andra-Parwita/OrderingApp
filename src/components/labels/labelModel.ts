import type { OrderLine, SellerOrder } from '../../../shared/domain';

export type LabelPaper = 'a4' | 'roll';
export type LabelFilter = 'confirmed' | 'notCancelled' | 'selected';

/** Labels hold a short packing/allergy aid, not the whole note (D-027). */
export const LABEL_NOTE_MAX = 70;
/** A4 sheet of 2 columns by 7 rows. */
export const LABELS_PER_SHEET = 14;

/**
 * Item lines that fit one printed label (D-091). Worked out from the print CSS: content height
 * (38 mm A4 / 40 mm roll, less 2 × 2 mm padding) minus the 16 mm code/name/QR block and the
 * 8 pt where line leaves 13.75 mm; at 8 pt × 1.15 each line is 3.25 mm, so 4 lines. The 8 pt
 * note costs one line (two for a long note, plan 104), so the last part of an order with a note holds fewer.
 */
export const LINES_PER_LABEL: Readonly<Record<LabelPaper, number>> = { a4: 4, roll: 4 };

export type LabelPart = Readonly<{
  order: SellerOrder;
  lines: ReadonlyArray<OrderLine>;
  /** 1-based. */
  index: number;
  of: number;
  /** The note prints on the last part only. */
  showNote: boolean;
}>;

/** A note up to this long fits one printed line (8 pt, 93 mm wide); longer ones take two (plan 104). */
export const NOTE_ONE_LINE = 45;

/** Item-line slots the note row costs on the last label: 1 for a short note, 2 for a long one. */
export function noteSlots(note: string): number {
  return truncateNote(note).length > NOTE_ONE_LINE ? 2 : 1;
}

/** An order as one or more labels, split by whole item lines, never mid-line. */
export function splitOrder(order: SellerOrder, paper: LabelPaper): Array<LabelPart> {
  const size = LINES_PER_LABEL[paper];
  const chunks = chunk(order.lines, size);
  const hasNote = truncateNote(order.note ?? '') !== '';
  const last = chunks.at(-1);
  // The last part needs room for the note: move the lines that don't fit to a part of their own.
  const moved = hasNote && last ? last.splice(size - noteSlots(order.note ?? '')) : [];
  if (moved.length > 0) chunks.push(moved);
  if (chunks.length === 0) chunks.push([]);
  return chunks.map((lines, i) => ({
    order,
    lines,
    index: i + 1,
    of: chunks.length,
    showNote: hasNote && i === chunks.length - 1,
  }));
}

/** Every label to print, in order, parts of one order together. */
export function labelsFor(orders: ReadonlyArray<SellerOrder>, paper: LabelPaper): Array<LabelPart> {
  return orders.flatMap((order) => splitOrder(order, paper));
}

/** The note cut to at most `max` characters in total, ending in an ellipsis when it was cut. */
export function truncateNote(note: string, max: number = LABEL_NOTE_MAX): string {
  const text = note.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * "2× Lemper ayam / Chicken lemper": Indonesian first, then English; one name if they match.
 * Plan 111: a line note follows in brackets, cut like the order note.
 */
export function itemText(line: Pick<OrderLine, 'qty' | 'name' | 'note'>): string {
  const id = line.name.id.trim();
  const en = line.name.en.trim();
  const name = id === '' || en === '' || id === en ? id || en : `${id} / ${en}`;
  const note = truncateNote(line.note ?? '');
  return `${String(line.qty)}× ${name}${note === '' ? '' : ` (${note})`}`;
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
