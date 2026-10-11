import { describe, expect, it } from 'vitest';
import { chunk, itemText, LABEL_NOTE_MAX, pickOrders, truncateNote } from './labelModel';
import { line, sampleOrders } from './testSupport';

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
      'Rina',
      'Sari',
    ]);
    expect(pickOrders(orders, 'notCancelled', new Set()).map((o) => o.firstName)).toEqual([
      'Rina',
      'Tom',
      'Sari',
    ]);
    expect(pickOrders(orders, 'selected', new Set(['o2'])).map((o) => o.firstName)).toEqual([
      'Tom',
    ]);
  });
});

describe('chunk', () => {
  it('splits into pages', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 14)).toEqual([]);
  });
});
