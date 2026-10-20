import { describe, expect, it } from 'vitest';
import type { OrderLine, SellerMenuItemView } from '../../../shared/domain';
import { cookGroups, countedOrders, type CookMenu } from './cookModel';
import { DEFAULT_PRINT_OPTIONS, buildKitchenPrint } from './kitchenPrintModel';
import { makeOrder } from './testSupport';

// Plan 111: a dish with choices counts per choice under a total; line notes sit under their row.

const text = (en: string) => ({ en, id: en });
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
const MENU: CookMenu = {
  kitchenName: 'Delave',
  cookingDate: '2026-10-10',
  chefs: [],
  items: [
    item('siomay', 'Siomay'),
    item('snack', 'Snacks'),
    item('cheese', 'Cheese', { groupId: 'snack', limit: 10 }),
    item('sweet', 'Sweet', { groupId: 'snack' }),
  ],
};
const line = (itemId: string, name: string, qty: number, note?: string): OrderLine => ({
  itemId,
  name: text(name),
  size: text('1 pack'),
  priceCents: 600,
  qty,
  ...(note ? { note } : {}),
});
const orders = () => [
  makeOrder({
    id: 'a',
    code: 'AAAAAA',
    firstName: 'Anin',
    lines: [
      line('cheese', 'Snacks · Cheese', 2),
      line('sweet', 'Snacks · Sweet', 1, 'extra crispy'),
    ],
  }),
  makeOrder({
    id: 'b',
    code: 'BBBBBB',
    firstName: 'Rina',
    lines: [line('siomay', 'Siomay', 6, 'no pare'), line('cheese', 'Snacks · Cheese', 3)],
  }),
];
const shape = (rows: ReadonlyArray<{ itemId: string; qty: number; group?: true; choice?: true }>) =>
  rows.map((r) => [r.itemId, r.qty, r.group === true, r.choice === true]);
const EXPECTED = [
  ['siomay', 6, false, false],
  ['snack', 6, true, false],
  ['cheese', 5, false, true],
  ['sweet', 1, false, true],
];

describe('cook list with choices', () => {
  it('heads a dish with its total and lists each choice under it by its own name', () => {
    const [group] = cookGroups(countedOrders(orders(), 'all'), MENU, 'item');
    const rows = group?.rows ?? [];
    expect(shape(rows)).toEqual(EXPECTED);
    expect(rows[2]?.name.en).toBe('Cheese');
    expect(rows[2]?.limit).toBe(10);
  });

  it('keeps a line note on its own row with the customer', () => {
    const [group] = cookGroups(countedOrders(orders(), 'all'), MENU, 'item');
    const rows = group?.rows ?? [];
    expect(rows[0]?.notes).toMatchObject([{ firstName: 'Rina', note: 'no pare' }]);
    expect(rows[3]?.notes?.[0]).toMatchObject({ firstName: 'Anin', note: 'extra crispy' });
    expect(rows[1]?.notes).toBeUndefined();
  });

  it('leaves a choice as one plain row when its dish is not in the menu list', () => {
    const [group] = cookGroups(countedOrders(orders(), 'all'), { ...MENU, items: [] }, 'item');
    expect(group?.rows.some((r) => r.group)).toBe(false);
  });
});

describe('kitchen print with choices', () => {
  it('prints the group row, indented choices and, with notes on, line notes', () => {
    const plan = buildKitchenPrint(countedOrders(orders(), 'all'), MENU, {
      ...DEFAULT_PRINT_OPTIONS,
      notes: true,
    });
    const rows = plan.sections[0]?.rows ?? [];
    expect(shape(rows)).toEqual(EXPECTED);
    expect(rows[0]?.lineNotes).toEqual([{ firstName: 'Rina', note: 'no pare' }]);
    expect(rows[3]?.lineNotes).toEqual([
      { firstName: 'Anin', note: 'extra crispy', choice: { en: 'Sweet', id: 'Sweet' } },
    ]);
  });

  it('leaves line notes off the page unless asked', () => {
    const plan = buildKitchenPrint(countedOrders(orders(), 'all'), MENU, DEFAULT_PRINT_OPTIONS);
    expect(plan.sections[0]?.rows.some((r) => r.lineNotes)).toBe(false);
  });
});
