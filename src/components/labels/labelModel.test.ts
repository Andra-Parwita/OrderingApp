import { describe, expect, it } from 'vitest';
import type { OrderLine, SellerOrder } from '../../../shared/domain';
import {
  chunk,
  itemText,
  LABEL_NOTE_MAX,
  labelsFor,
  LINES_PER_LABEL,
  pickOrders,
  splitOrder,
  noteSlots,
  truncateNote,
} from './labelModel';

function line(itemId: string, en: string, id: string, qty: number): OrderLine {
  return { itemId, name: { en, id }, size: { en: '1', id: '1' }, priceCents: 1000, qty };
}
function order(id: string, status: SellerOrder['status'], lines: Array<OrderLine>, note?: string) {
  return {
    id,
    code: id.toUpperCase().padEnd(6, 'X'),
    firstName: id,
    status,
    lines,
    ...(note ? { note } : {}),
  } as SellerOrder;
}
const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => line(`i${i}`, `Dish ${i}`, `Hidangan ${i}`, 1));
function sampleOrders(): Array<SellerOrder> {
  return [
    order('rina', 'confirmed', lines(1)),
    order('tom', 'ordered', lines(1)),
    order('dewi', 'cancelled', lines(1)),
    order('sari', 'confirmed', lines(1)),
  ];
}

describe('truncateNote', () => {
  it('keeps a short note and cuts a long one to 70 characters with an ellipsis', () => {
    expect(truncateNote('No chilli')).toBe('No chilli');
    const exact = 'x'.repeat(LABEL_NOTE_MAX);
    expect(truncateNote(exact)).toBe(exact);
    const cut = truncateNote('y'.repeat(100));
    expect(cut).toHaveLength(LABEL_NOTE_MAX);
    expect(cut.endsWith('…')).toBe(true);
  });
});

describe('noteSlots', () => {
  it('a long note costs two item lines on the last label, a short one costs one', () => {
    expect(noteSlots('No chilli')).toBe(1);
    expect(noteSlots('n'.repeat(60))).toBe(2);
    const parts = splitOrder(order('a', 'confirmed', lines(4), 'n'.repeat(60)), 'a4');
    expect(parts.map((p) => p.lines.length)).toEqual([2, 2]);
    expect(parts.map((p) => p.showNote)).toEqual([false, true]);
  });
});

describe('itemText', () => {
  it('shows Indonesian then English, and one name when they match or one is empty', () => {
    expect(itemText(line('a', 'Chicken lemper', 'Lemper ayam', 2))).toBe(
      '2× Lemper ayam / Chicken lemper',
    );
    expect(itemText(line('a', 'Pesmol', 'Pesmol', 1))).toBe('1× Pesmol');
    expect(itemText(line('a', '', 'Nasi campur', 1))).toBe('1× Nasi campur');
  });
});

describe('pickOrders', () => {
  it('filters by status or by selection', () => {
    const orders = sampleOrders();
    expect(pickOrders(orders, 'confirmed', new Set()).map((o) => o.firstName)).toEqual([
      'rina',
      'sari',
    ]);
    expect(pickOrders(orders, 'notCancelled', new Set()).map((o) => o.firstName)).toEqual([
      'rina',
      'tom',
      'sari',
    ]);
    expect(pickOrders(orders, 'selected', new Set(['tom'])).map((o) => o.firstName)).toEqual([
      'tom',
    ]);
  });
});

describe('chunk', () => {
  it('splits into pages', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 14)).toEqual([]);
  });
});

describe('splitOrder', () => {
  it('keeps a short order on one label', () => {
    const parts = splitOrder(order('a', 'confirmed', lines(3), 'No chilli'), 'a4');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ index: 1, of: 1, showNote: true });
  });

  it('splits 12 lines over labels with every line exactly once, in order', () => {
    for (const paper of ['a4', 'roll'] as const) {
      const all = lines(12);
      const parts = splitOrder(order('a', 'confirmed', all), paper);
      expect(parts).toHaveLength(Math.ceil(12 / LINES_PER_LABEL[paper]));
      expect(parts.flatMap((p) => p.lines.map((l) => l.itemId))).toEqual(all.map((l) => l.itemId));
      expect(parts.map((p) => p.index)).toEqual(parts.map((_, i) => i + 1));
      expect(parts.every((p) => p.of === parts.length)).toBe(true);
    }
  });

  it('50 lines: every line on exactly one label, in order, nothing dropped', () => {
    for (const paper of ['a4', 'roll'] as const) {
      const all = lines(50);
      const parts = splitOrder(order('a', 'confirmed', all, 'No chilli'), paper);
      expect(parts.flatMap((p) => p.lines.map((l) => l.itemId))).toEqual(all.map((l) => l.itemId));
      expect(parts.every((p) => p.lines.length <= LINES_PER_LABEL[paper])).toBe(true);
      expect(parts.filter((p) => p.showNote)).toHaveLength(1);
      expect(parts.at(-1)?.showNote).toBe(true);
    }
  });

  it('puts the note on the last part only, and gives it room', () => {
    const parts = splitOrder(order('a', 'confirmed', lines(8), 'Allergic'), 'a4');
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.showNote)).toEqual([false, false, true]);
    expect(parts.every((p) => p.lines.length <= LINES_PER_LABEL.a4)).toBe(true);
    expect(splitOrder(order('b', 'confirmed', lines(8)), 'a4')).toHaveLength(2);
  });

  it('counts labels over orders and still makes one label for an order with no lines', () => {
    const orders = [order('a', 'confirmed', lines(12)), order('b', 'confirmed', lines(1))];
    expect(labelsFor(orders, 'a4')).toHaveLength(4);
    expect(splitOrder(order('c', 'confirmed', []), 'roll')).toHaveLength(1);
  });
});

describe('splitOrder', () => {
  it('keeps a short order on one label with no "1 of 1"', () => {
    const parts = splitOrder(order('a', 'confirmed', lines(3), 'No chilli'), 'a4');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ index: 1, of: 1, showNote: true });
  });

  it('splits 12 lines over labels with every line exactly once, in order', () => {
    for (const paper of ['a4', 'roll'] as const) {
      const all = lines(12);
      const parts = splitOrder(order('a', 'confirmed', all), paper);
      expect(parts).toHaveLength(Math.ceil(12 / LINES_PER_LABEL[paper]));
      expect(parts.flatMap((p) => p.lines.map((l) => l.itemId))).toEqual(all.map((l) => l.itemId));
      expect(parts.map((p) => p.index)).toEqual(parts.map((_, i) => i + 1));
      expect(parts.every((p) => p.of === parts.length)).toBe(true);
    }
  });

  it('puts the note on the last part only, and gives it room', () => {
    const parts = splitOrder(order('a', 'confirmed', lines(8), 'Allergic'), 'a4');
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.showNote)).toEqual([false, false, true]);
    expect(parts.every((p) => p.lines.length <= LINES_PER_LABEL.a4)).toBe(true);
    expect(parts.at(-1)?.lines.length).toBeLessThan(LINES_PER_LABEL.a4);
    expect(splitOrder(order('b', 'confirmed', lines(8)), 'a4')).toHaveLength(2);
  });

  it('counts labels over orders and still makes one label for an order with no lines', () => {
    const orders = [order('a', 'confirmed', lines(12)), order('b', 'confirmed', lines(1))];
    expect(labelsFor(orders, 'a4')).toHaveLength(4);
    expect(splitOrder(order('c', 'confirmed', []), 'roll')).toHaveLength(1);
  });
});
