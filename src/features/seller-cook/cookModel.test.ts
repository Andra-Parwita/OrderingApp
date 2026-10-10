import { describe, expect, it } from 'vitest';
import {
  chefChoices,
  cookGroups,
  cookNotes,
  cookStats,
  countedOrders,
  filterByChef,
  type CookGroup,
} from './cookModel';
import { MENU, line, makeOrder, sampleOrders } from './testSupport';

const qtys = (group: CookGroup | undefined) =>
  Object.fromEntries((group?.rows ?? []).map((row) => [row.itemId, row.qty]));

describe('countedOrders', () => {
  it('leaves out cancelled orders, and ordered ones in Confirmed only mode', () => {
    expect(countedOrders(sampleOrders(), 'all').map((o) => o.firstName)).toEqual([
      'Rina',
      'Tom',
      'Sari',
    ]);
    expect(countedOrders(sampleOrders(), 'confirmed').map((o) => o.firstName)).toEqual([
      'Rina',
      'Sari',
    ]);
  });
});

describe('cookStats', () => {
  it('sums income without cancelled orders and splits it into paid and unpaid', () => {
    // Rina 2x10 + 1x15 = 35 (paid), Tom 3x10 + 1x10 = 40, Sari 2x12.50 = 25; Dewi (cancelled) = 100
    expect(cookStats(countedOrders(sampleOrders(), 'all'))).toEqual({
      orders: 3,
      incomeCents: 10000,
      paidCents: 3500,
      unpaidCents: 6500,
    });
  });

  it('follows the count mode', () => {
    expect(cookStats(countedOrders(sampleOrders(), 'confirmed'))).toEqual({
      orders: 2,
      incomeCents: 6000,
      paidCents: 3500,
      unpaidCents: 2500,
    });
  });

  it('is all zero with no orders', () => {
    expect(cookStats([])).toEqual({ orders: 0, incomeCents: 0, paidCents: 0, unpaidCents: 0 });
  });
});

describe('cookGroups', () => {
  const counted = countedOrders(sampleOrders(), 'all');

  it('by item: one list in menu order with totals, limits and who ordered', () => {
    const groups = cookGroups(counted, MENU, 'item');
    expect(groups).toHaveLength(1);
    const rows = groups[0]?.rows ?? [];
    expect(rows.map((row) => row.itemId)).toEqual(['nasi', 'lemper', 'tempe', 'ayam']);
    // The cancelled order's 10 lempers are not counted.
    expect(qtys(groups[0])).toEqual({ nasi: 1, lemper: 5, tempe: 1, ayam: 2 });
    const lemper = rows.find((row) => row.itemId === 'lemper');
    expect(lemper?.limit).toBe(20);
    expect(lemper?.who).toEqual([
      { code: 'K7F-2QX', firstName: 'Rina', qty: 2, fulfilment: 'pickup' },
      { code: 'M3H-9TD', firstName: 'Tom', qty: 3, fulfilment: 'delivery' },
    ]);
    expect(rows.find((row) => row.itemId === 'nasi')?.limit).toBeUndefined();
  });

  it('by item in Confirmed only mode leaves out the ordered order', () => {
    const groups = cookGroups(countedOrders(sampleOrders(), 'confirmed'), MENU, 'item');
    expect(qtys(groups[0])).toEqual({ nasi: 1, lemper: 2, ayam: 2 });
  });

  it('by chef: items without a chef sit under the kitchen name, then each chef', () => {
    const groups = cookGroups(counted, MENU, 'chef');
    expect(groups.map((group) => group.title)).toEqual(['Delave', 'Chef Wati']);
    expect(qtys(groups[0])).toEqual({ nasi: 1, ayam: 2 });
    expect(qtys(groups[1])).toEqual({ lemper: 5, tempe: 1 });
  });

  it('by chef: a chef with nothing to cook has no section, an unknown chef is the seller', () => {
    const only = [makeOrder({ lines: [line('nasi', 1)] })];
    expect(cookGroups(only, MENU, 'chef').map((group) => group.title)).toEqual(['Delave']);
    const stale = { ...MENU, chefs: [] };
    expect(cookGroups(counted, stale, 'chef').map((group) => group.title)).toEqual(['Delave']);
  });

  it('by customer: one section per order with its own lines', () => {
    const groups = cookGroups(counted, MENU, 'customer');
    expect(groups.map((group) => group.title)).toEqual([
      'Rina · K7F-2QX',
      'Tom · M3H-9TD',
      'Sari · R8P-4WB',
    ]);
    expect(qtys(groups[1])).toEqual({ lemper: 3, tempe: 1 });
    expect(groups[1]?.rows[0]?.limit).toBeUndefined();
  });

  it('by pickup/delivery: totals per fulfilment', () => {
    const groups = cookGroups(counted, MENU, 'fulfilment');
    expect(groups.map((group) => group.fulfilment)).toEqual(['pickup', 'delivery']);
    expect(qtys(groups[0])).toEqual({ nasi: 1, lemper: 2 });
    expect(qtys(groups[1])).toEqual({ lemper: 3, tempe: 1, ayam: 2 });
  });

  it('keeps an item that is no longer on the menu (its order snapshot) after the others', () => {
    const gone = makeOrder({
      lines: [
        {
          itemId: 'old',
          name: { en: 'Old dish', id: 'Menu lama' },
          size: { en: '1 box', id: '1 box' },
          priceCents: 500,
          qty: 1,
        },
        line('nasi', 1),
      ],
    });
    const rows = cookGroups([gone], MENU, 'item')[0]?.rows ?? [];
    expect(rows.map((row) => row.itemId)).toEqual(['nasi', 'old']);
  });

  it('has no groups when nothing is counted', () => {
    expect(cookGroups([], MENU, 'item')).toEqual([]);
  });
});

describe('chef filter', () => {
  const counted = countedOrders(sampleOrders(), 'all');

  it('offers the kitchen and each chef, and nothing without chefs', () => {
    expect(chefChoices(MENU)).toEqual([
      { value: 'seller', label: 'Delave' },
      { value: 'chef-wati', label: 'Chef Wati' },
    ]);
    expect(chefChoices({ ...MENU, chefs: [] })).toEqual([]);
  });

  it("keeps only a chef's lines and drops orders left empty", () => {
    const orders = filterByChef(counted, MENU, 'chef-wati');
    expect(orders.map((order) => [order.firstName, order.lines.map((l) => l.itemId)])).toEqual([
      ['Rina', ['lemper']],
      ['Tom', ['lemper', 'tempe']],
    ]);
    const rows = cookGroups(orders, MENU, 'item')[0]?.rows ?? [];
    expect(rows.map((row) => [row.itemId, row.qty])).toEqual([
      ['lemper', 5],
      ['tempe', 1],
    ]);
  });

  it('picks the dishes without a chef for the kitchen, and everything for All', () => {
    const seller = filterByChef(counted, MENU, 'seller');
    expect(seller.map((order) => [order.firstName, order.lines.map((l) => l.itemId)])).toEqual([
      ['Rina', ['nasi']],
      ['Sari', ['ayam']],
    ]);
    expect(filterByChef(counted, MENU, 'all')).toBe(counted);
  });
});

describe('cookNotes', () => {
  it('lists the note of every counted order with code and name', () => {
    expect(cookNotes(countedOrders(sampleOrders(), 'all'))).toEqual([
      { code: 'K7F-2QX', firstName: 'Rina', note: 'No chilli on the tempeh please' },
      { code: 'M3H-9TD', firstName: 'Tom', note: 'Peanut allergy' },
    ]);
  });

  it('skips cancelled orders and blank notes', () => {
    const orders = [
      makeOrder({ note: '   ' }),
      makeOrder({ id: 'x', status: 'cancelled', note: 'gone' }),
    ];
    expect(cookNotes(countedOrders(orders, 'all'))).toEqual([]);
  });
});
