import { describe, expect, it } from 'vitest';
import { csvField, CSV_BOM, ordersToCsv } from './csv';
import type { SellerOrder } from './domain';
import {
  applyRetention,
  keepsOrderDetails,
  orderTotalCents,
  parsePastWeek,
  parsePastWeekSummary,
  shiftDays,
  summariseOrders,
  toSummary,
  type PastWeek,
} from './pastWeeks';

const text = (en: string) => ({ en, id: `${en} id` });

function order(
  code: string,
  lines: Array<[string, number, number]>,
  extra: Partial<SellerOrder> = {},
): SellerOrder {
  return {
    id: `id-${code}`,
    sellerId: 's1',
    code,
    token: `tok-${code}`,
    firstName: 'Rina',
    language: 'en',
    lines: lines.map(([itemId, priceCents, qty]) => ({
      itemId,
      name: text(itemId),
      size: text('1'),
      priceCents,
      qty,
    })),
    fulfilment: 'pickup',
    status: 'collected',
    paid: false,
    locked: false,
    waReceived: false,
    returning: false,
    changed: false,
    inbox: [],
    audit: [],
    createdAt: '2026-10-07T10:00:00.000Z',
    updatedAt: '2026-10-07T10:00:00.000Z',
    ...extra,
  };
}

const orders = [
  order('AAAAAA', [['lemper', 1000, 2]], { paid: true }),
  order('BBBBBB', [
    ['lemper', 1000, 1],
    ['pesmol', 1500, 1],
  ]),
  order('CCCCCC', [['pesmol', 1500, 3]], { status: 'cancelled', paid: true }),
];

describe('week totals', () => {
  it('sums orders, income, paid and unpaid, and quantities per item, ignoring cancelled', () => {
    const totals = summariseOrders(orders);
    expect(totals).toMatchObject({
      orders: 2,
      cancelled: 1,
      incomeCents: 4500,
      paidCents: 2000,
      unpaidCents: 2500,
    });
    expect(totals.items).toEqual([
      { itemId: 'lemper', name: text('lemper'), qty: 3 },
      { itemId: 'pesmol', name: text('pesmol'), qty: 1 },
    ]);
    expect(orderTotalCents(orders[1] as SellerOrder)).toBe(2500);
  });

  it('is all zero for no orders', () => {
    expect(summariseOrders([])).toEqual({
      orders: 0,
      cancelled: 0,
      incomeCents: 0,
      paidCents: 0,
      unpaidCents: 0,
      items: [],
    });
  });
});

describe('retention: order details for 4 weeks after the cooking date', () => {
  const week: PastWeek = {
    id: 'w1',
    cookingDate: '2026-10-10',
    closedAt: '2026-10-11T00:00:00.000Z',
    totals: summariseOrders(orders),
    orders,
  };

  it('keeps the orders until cooking date + 28 days, then only totals', () => {
    expect(keepsOrderDetails('2026-10-10', new Date('2026-11-06T23:59:59Z'))).toBe(true);
    expect(keepsOrderDetails('2026-10-10', new Date('2026-11-07T00:00:00Z'))).toBe(false);
    expect(applyRetention(week, new Date('2026-11-06T23:59:59Z')).orders).toHaveLength(3);
    const reduced = applyRetention(week, new Date('2026-11-07T00:00:00Z'));
    expect(reduced.orders).toBeUndefined();
    expect(reduced.totals).toEqual(week.totals);
    expect(reduced.cookingDate).toBe('2026-10-10');
  });

  it('does not change its input and is idempotent', () => {
    const later = new Date('2027-01-01T00:00:00Z');
    const once = applyRetention(week, later);
    expect(week.orders).toHaveLength(3);
    expect(applyRetention(once, later)).toEqual(once);
  });

  it('summarises with hasOrders', () => {
    expect(toSummary(week)).toMatchObject({ id: 'w1', hasOrders: true });
    expect(toSummary(applyRetention(week, new Date('2027-01-01T00:00:00Z'))).hasOrders).toBe(false);
  });

  it('round-trips through the response parsers', () => {
    expect(parsePastWeek(JSON.parse(JSON.stringify(week)))).toEqual(week);
    expect(parsePastWeekSummary(toSummary(week))).toEqual(toSummary(week));
    expect(parsePastWeek({ ...week, totals: { orders: -1 } })).toBeNull();
  });
});

describe('shiftDays', () => {
  it('moves the date and keeps the time and offset', () => {
    expect(shiftDays('2026-10-10', 7)).toBe('2026-10-17');
    expect(shiftDays('2026-10-09T21:00:00+11:00', 7)).toBe('2026-10-16T21:00:00+11:00');
    expect(shiftDays('2026-12-28', 7)).toBe('2027-01-04');
  });
});

describe('orders CSV', () => {
  it('quotes commas, quotes and line breaks, and defuses formulas', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField('+61 400')).toBe("'+61 400");
  });

  it('writes a BOM, a header, CRLF lines and one row per order', () => {
    const rows = [
      order(
        'K7F2QX',
        [
          ['Lemper, ayam', 1000, 2],
          ['Pesmol', 1550, 1],
        ],
        {
          firstName: 'Ibu "Ani"',
          paid: true,
          fulfilment: 'delivery',
        },
      ),
    ];
    const csv = ordersToCsv(rows);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('code,first name,items,total,status,paid,pickup/delivery,created');
    expect(lines[1]).toBe(
      'K7F-2QX,"Ibu ""Ani""","2 x Lemper, ayam; 1 x Pesmol",35.50,collected,yes,delivery,2026-10-07T10:00:00.000Z',
    );
    expect(lines[2]).toBe('');
  });

  it('is just the header for no orders', () => {
    expect(ordersToCsv([]).split('\r\n')[0]).toContain('code,first name');
  });
});
