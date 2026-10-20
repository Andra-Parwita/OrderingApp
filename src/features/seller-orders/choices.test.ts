import { describe, expect, it } from 'vitest';
import type { Order, OrderLine, SellerMenuItemView } from '../../../shared/domain';
import { addDish, buildEditRequest, initialRows, isChanged, patchRow } from './editOrderModel';
import { itemsSummary } from './orderText';
import { pickableItems } from './pickItems';
import { itemsLine } from './printModel';

// Plan 111: the seller picks a choice as "Dish · Choice" and may write a note on a line.

const text = (en: string, id = en) => ({ en, id });
const item = (id: string, name: string, extra: Partial<SellerMenuItemView> = {}) => ({
  id,
  name: text(name),
  description: text(''),
  size: text('1 pack'),
  priceCents: 600,
  remaining: null,
  soldOut: false,
  ...extra,
});
const MENU = [
  item('siomay', 'Siomay'),
  item('snack', 'Snacks', { name: text('Snacks', 'Aneka') }),
  item('cheese', 'Cheese', { groupId: 'snack', name: text('Cheese', 'Keju') }),
  item('sweet', 'Sweet', { groupId: 'snack' }),
];
const lineOf = (itemId: string, name: string, qty: number, note?: string): OrderLine => ({
  itemId,
  name: text(name),
  size: text('1 pack'),
  priceCents: 600,
  qty,
  ...(note ? { note } : {}),
});
const order = (lines: Array<OrderLine>) => ({ id: 'o1', firstName: 'Anin', lines }) as Order;
const SAVE = { notify: false, force: false, reactivate: false };

describe('pickable items', () => {
  it('lists choices as "Dish · Choice" and leaves out the dish that has them', () => {
    const picks = pickableItems(MENU);
    expect(picks.map((p) => p.id)).toEqual(['siomay', 'cheese', 'sweet']);
    expect(picks[1]?.name).toEqual({ en: 'Snacks · Cheese', id: 'Aneka · Keju' });
  });

  it('sells a choice out when its dish is sold out', () => {
    const picks = pickableItems(MENU.map((m) => (m.id === 'snack' ? { ...m, soldOut: true } : m)));
    expect(picks.find((p) => p.id === 'sweet')?.soldOut).toBe(true);
    expect(picks.find((p) => p.id === 'siomay')?.soldOut).toBe(false);
  });
});

describe('edit order with line notes', () => {
  const saved = order([lineOf('cheese', 'Snacks · Cheese', 2, 'extra crispy')]);

  it('keeps an untouched note: nothing is sent for it', () => {
    const rows = initialRows(saved);
    expect(isChanged(saved, { rows, name: 'Anin', note: '' })).toBe(false);
    const request = buildEditRequest(
      saved,
      { rows: patchRow(rows, 'cheese', { qty: 3 }), name: 'Anin', note: '' },
      SAVE,
    );
    expect(request.lines).toEqual([{ itemId: 'cheese', qty: 3 }]);
  });

  it('sends a changed note, and an empty one to clear it', () => {
    const rows = initialRows(saved);
    const changed = buildEditRequest(
      saved,
      { rows: patchRow(rows, 'cheese', { note: ' less salt ' }), name: 'Anin', note: '' },
      SAVE,
    );
    expect(changed.lines).toEqual([{ itemId: 'cheese', qty: 2, note: 'less salt' }]);
    const cleared = buildEditRequest(
      saved,
      { rows: patchRow(rows, 'cheese', { note: '' }), name: 'Anin', note: '' },
      SAVE,
    );
    expect(cleared.lines).toEqual([{ itemId: 'cheese', qty: 2, note: '' }]);
  });

  it('adds a picked choice under the name the order line will get', () => {
    const pick = pickableItems(MENU).find((p) => p.id === 'sweet');
    if (!pick) throw new Error('no pick');
    const rows = addDish(initialRows(saved), pick);
    expect(rows.at(-1)).toMatchObject({ itemId: 'sweet', name: { en: 'Snacks · Sweet' }, qty: 1 });
    const request = buildEditRequest(
      saved,
      { rows: patchRow(rows, 'sweet', { note: 'no sugar' }), name: 'Anin', note: '' },
      SAVE,
    );
    expect(request.lines?.[1]).toEqual({ itemId: 'sweet', qty: 1, note: 'no sugar' });
  });
});

describe('order text with line notes', () => {
  const withNote = order([
    lineOf('cheese', 'Snacks · Cheese', 2, 'extra crispy'),
    lineOf('siomay', 'Siomay', 1),
  ]);
  it('puts the note in brackets after its line in the summary and the printed list', () => {
    expect(itemsSummary(withNote, 'en')).toBe('2 Snacks · Cheese (extra crispy), 1 Siomay');
    expect(itemsLine(withNote, 'en')).toBe('2 × Snacks · Cheese (extra crispy), 1 × Siomay');
  });
});
