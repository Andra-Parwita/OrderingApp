import { describe, expect, it } from 'vitest';
import { countedOrders } from './cookModel';
import {
  DEFAULT_PRINT_OPTIONS,
  buildKitchenPrint,
  type KitchenPrintOptions,
} from './kitchenPrintModel';
import { MENU, line, makeOrder, sampleOrders } from './testSupport';

const counted = () => countedOrders(sampleOrders(), 'all');
const build = (extra: Partial<KitchenPrintOptions> = {}, orders = counted()) =>
  buildKitchenPrint(orders, MENU, { ...DEFAULT_PRINT_OPTIONS, ...extra });
const privateOrder = () =>
  makeOrder({
    id: 'p1',
    code: 'P2Q4ZX',
    firstName: 'Guest',
    lines: [line('lemper', 4)],
    private: { eventDate: '2026-10-10' },
  });

describe('buildKitchenPrint', () => {
  it('totals each dish with its pickup/delivery split and distinct people', () => {
    const [section] = build().sections;
    const lemper = section?.rows.find((row) => row.itemId === 'lemper');
    // Rina 2 (pickup) + Tom 3 (delivery)
    expect(lemper).toMatchObject({ qty: 5, pickup: 2, delivery: 3, people: 2, privateQty: 0 });
    expect(section?.rows.find((row) => row.itemId === 'ayam')).toMatchObject({
      qty: 2,
      delivery: 2,
      people: 1,
    });
  });

  it('counts an order once for "for N people" even with two lines of one dish', () => {
    const order = makeOrder({ lines: [line('nasi', 1), line('nasi', 2)] });
    const [section] = build({}, [order]).sections;
    expect(section?.rows[0]).toMatchObject({ qty: 3, people: 1 });
  });

  it('leaves private orders out unless ticked, then counts them with privateQty', () => {
    const orders = [...counted(), privateOrder()];
    const off = build({ includePrivate: false }, orders).sections[0]?.rows;
    expect(off?.find((r) => r.itemId === 'lemper')?.qty).toBe(5);
    const on = build({ includePrivate: true }, orders).sections[0]?.rows;
    expect(on?.find((r) => r.itemId === 'lemper')).toMatchObject({ qty: 9, privateQty: 4 });
  });

  it('adds the notes (code, name, note) only when asked', () => {
    expect(build().notes).toEqual([]);
    const notes = build({ notes: true }).notes;
    expect(notes.map((n) => [n.firstName, n.note])).toEqual([
      ['Rina', 'No chilli on the tempeh please'],
      ['Tom', 'Peanut allergy'],
    ]);
  });

  it('prints one chef only, with that chef notes only', () => {
    const plan = build({ chef: 'chef-wati', notes: true });
    expect(plan.sections[0]?.rows.map((r) => r.itemId)).toEqual(['lemper', 'tempe']);
    expect(plan.notes).toHaveLength(2);
    const seller = build({ chef: 'seller', notes: true });
    expect(seller.sections[0]?.rows.map((r) => r.itemId)).toEqual(['nasi', 'ayam']);
    expect(seller.notes.map((n) => n.firstName)).toEqual(['Rina']);
  });

  it('groups by chef, with a new page per chef only when asked', () => {
    const plain = build({ groupBy: 'chef' }).sections;
    expect(plain.map((s) => s.title)).toEqual(['Delave', 'Chef Wati']);
    expect(plain.some((s) => s.pageBreak)).toBe(false);
    const paged = build({ groupBy: 'chef', pagePerChef: true }).sections;
    expect(paged.map((s) => s.pageBreak)).toEqual([false, true]);
    // Group by dish never breaks pages.
    expect(build({ groupBy: 'item', pagePerChef: true }).sections.some((s) => s.pageBreak)).toBe(
      false,
    );
  });

  it('is empty with no orders', () => {
    expect(build({}, [])).toEqual({ sections: [], notes: [] });
  });
});
