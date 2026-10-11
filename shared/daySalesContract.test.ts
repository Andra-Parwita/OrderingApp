import { describe, expect, it } from 'vitest';
import { parseMenuItem, parseCreateItemRequest, parseUpdateItemRequest } from './setupContract';
import {
  parseDayCountRequest,
  parseDayLogResponse,
  parseDaySaleRequest,
  parseDayStockResponse,
} from './daySalesContract';
import { parseMenuResponse } from './menuContract';

describe('day sales contract (plan 029)', () => {
  it('parses a sale and a set count, and refuses bad numbers', () => {
    expect(parseDaySaleRequest({ itemId: 'a', qty: 2 })).toEqual({ itemId: 'a', qty: 2 });
    expect(parseDaySaleRequest({ itemId: 'a', qty: 0 })).toBeNull();
    expect(parseDaySaleRequest({ itemId: '', qty: 1 })).toBeNull();
    expect(parseDaySaleRequest({ itemId: 'a', qty: 1.5 })).toBeNull();
    expect(parseDayCountRequest({ itemId: 'a', count: 0 })).toEqual({ itemId: 'a', count: 0 });
    expect(parseDayCountRequest({ itemId: 'a', count: -1 })).toBeNull();
    expect(parseDayCountRequest({ itemId: 'a', count: 10_000 })).toBeNull();
    expect(parseDayStockResponse({ itemId: 'a', dayStock: 3 })).toEqual({
      itemId: 'a',
      dayStock: 3,
    });
  });

  it('parses the log', () => {
    const entry = {
      id: 'e1',
      menuId: 'm1',
      itemId: 'a',
      kind: 'sale',
      change: -1,
      stockAfter: 4,
      by: 'Dewi',
      at: '2026-10-10T08:00:00.000Z',
      undone: false,
    };
    expect(parseDayLogResponse({ entries: [entry] })?.entries[0]).toEqual(entry);
    expect(parseDayLogResponse({ entries: [{ ...entry, kind: 'x' }] })).toBeNull();
  });

  it('item requests carry preorder and dayStock; on-the-day-only needs a stock', () => {
    const base = { name: { en: 'A', id: 'A' }, priceCents: 100 };
    expect(parseCreateItemRequest({ ...base, preorder: false, dayStock: 5 })).toMatchObject({
      preorder: false,
      dayStock: 5,
    });
    expect(parseCreateItemRequest({ ...base, preorder: false })).toBeNull();
    expect(parseCreateItemRequest({ ...base, dayStock: -1 })).toBeNull();
    expect(parseUpdateItemRequest({ dayStock: null })).toEqual({ dayStock: null });
    expect(parseUpdateItemRequest({ preorder: 'no' })).toBeNull();
    expect(
      parseMenuItem({
        ...base,
        id: 'a',
        name: base.name,
        description: base.name,
        size: base.name,
        dayStock: 3,
      }),
    ).toMatchObject({
      dayStock: 3,
    });
  });

  it('a customer menu never carries dayStock', () => {
    const item = {
      id: 'a',
      name: { en: 'A', id: 'A' },
      description: { en: '', id: '' },
      size: { en: '', id: '' },
      priceCents: 100,
      remaining: null,
      soldOut: false,
    };
    const menu = (extra: object) =>
      parseMenuResponse({
        seller: { id: 's', slug: 'onde-onde', name: 'S' },
        kitchen: { sellerId: 's', name: 'S', tagline: { en: 't', id: 't' } },
        week: {
          cookingDate: '2026-10-10',
          cutoffAt: '2026-10-09T10:00:00+11:00',
          status: 'published',
          pickupPoints: [],
          delivery: { available: false, note: { en: '', id: '' } },
        },
        items: [{ ...item, ...extra }],
        ordering: { open: true },
      });
    expect(menu({ onTheDay: 'available', preorder: false })).not.toBeNull();
    expect(menu({ dayStock: 3 })).toBeNull();
    expect(menu({ onTheDay: 'many' })).toBeNull();
  });
});
