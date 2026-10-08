import { describe, expect, it } from 'vitest';
import { diffOrder, formatAuditDiff } from './auditDiff';
import type { OrderLine } from './domain';

const line = (itemId: string, en: string, id: string, qty: number): OrderLine => ({
  itemId,
  name: { en, id },
  size: { en: '', id: '' },
  priceCents: 1000,
  qty,
});

const lemper = (qty: number) => line('lemper', 'Chicken lemper', 'Lemper ayam', qty);
const tempe = (qty: number) => line('tempe', 'Battered tempeh', 'Tempe mendoan', qty);

describe('diffOrder', () => {
  it('is null when nothing changed', () => {
    const order = { lines: [lemper(1)], fulfilment: 'pickup' as const };
    expect(diffOrder(order, { ...order })).toBeNull();
    expect(diffOrder({ ...order, note: undefined }, { ...order, note: '' })).toBeNull();
  });

  it('lists quantity deltas, adds, removals, note and fulfilment', () => {
    const diff = diffOrder(
      { lines: [lemper(1), tempe(1)], fulfilment: 'pickup', note: 'a' },
      { lines: [lemper(2)], fulfilment: 'delivery', note: 'b' },
    );
    expect(diff).toEqual({
      items: [
        { itemId: 'lemper', name: lemper(1).name, delta: 1 },
        { itemId: 'tempe', name: tempe(1).name, delta: -1 },
      ],
      note: true,
      fulfilment: { from: 'pickup', to: 'delivery' },
    });
  });
});

describe('formatAuditDiff', () => {
  const diff = {
    items: [
      { itemId: 'lemper', name: lemper(1).name, delta: 1 },
      { itemId: 'tempe', name: tempe(1).name, delta: -1 },
    ],
    note: true as const,
    fulfilment: { from: 'pickup' as const, to: 'delivery' as const },
  };

  it('formats English', () => {
    expect(formatAuditDiff(diff, 'en')).toBe(
      '+1 Chicken lemper · −1 Battered tempeh · note changed · pickup → delivery',
    );
  });

  it('formats Indonesian with the Indonesian item names', () => {
    expect(formatAuditDiff(diff, 'id')).toBe(
      '+1 Lemper ayam · −1 Tempe mendoan · catatan diubah · ambil → antar',
    );
  });
});
