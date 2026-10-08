import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerOrder } from '../../../shared/domain';
import {
  MY_ORDERS_KEY,
  hasUnseenUpdate,
  isReturningCustomer,
  markInboxSeen,
  readMyOrders,
  rememberStatus,
  saveMyOrder,
} from './myOrders';
import { buildWhatsAppText, whatsAppUrl } from './whatsapp';

function order(patch: Partial<CustomerOrder> = {}): CustomerOrder {
  return {
    id: 'o1',
    code: 'K7F2QX',
    token: 'tok-1',
    firstName: 'Rina',
    language: 'en',
    lines: [
      {
        itemId: 'lemper',
        name: { en: 'Chicken lemper', id: 'Lemper ayam' },
        size: { en: 'box', id: 'kotak' },
        priceCents: 1000,
        qty: 2,
      },
    ],
    fulfilment: 'pickup',
    status: 'ordered',
    locked: false,
    inbox: [{ at: '2026-10-07T10:00:00.000Z', kind: 'status', status: 'ordered' }],
    createdAt: '2026-10-07T10:00:00.000Z',
    updatedAt: '2026-10-07T10:00:00.000Z',
    ...patch,
  };
}

beforeEach(() => localStorage.removeItem(MY_ORDERS_KEY));
afterEach(() => vi.restoreAllMocks());

describe('device My orders', () => {
  it('saves newest first and marks the placed inbox as seen', () => {
    saveMyOrder(order());
    saveMyOrder(order({ code: 'AAAAAA', token: 'tok-2' }));
    const saved = readMyOrders();
    expect(saved.map((entry) => entry.token)).toEqual(['tok-2', 'tok-1']);
    expect(saved[1]).toMatchObject({
      code: 'K7F2QX',
      lastStatus: 'ordered',
      lastSeenInboxAt: '2026-10-07T10:00:00.000Z',
    });
  });

  it('keeps the seen marker and place when the same order is saved again', () => {
    saveMyOrder(order());
    saveMyOrder(
      order({
        status: 'confirmed',
        inbox: [
          { at: '2026-10-08T10:00:00.000Z', kind: 'status', status: 'confirmed' },
          { at: '2026-10-07T10:00:00.000Z', kind: 'status', status: 'ordered' },
        ],
      }),
    );
    expect(readMyOrders()).toHaveLength(1);
    expect(readMyOrders()[0]).toMatchObject({
      lastStatus: 'confirmed',
      lastSeenInboxAt: '2026-10-07T10:00:00.000Z',
    });
  });

  it.each([
    ['corrupt JSON', '{not json'],
    ['not an array', '{"a":1}'],
    ['null', 'null'],
  ])('reads %s as an empty list', (_name, raw) => {
    localStorage.setItem(MY_ORDERS_KEY, raw);
    expect(readMyOrders()).toEqual([]);
  });

  it('drops malformed entries and keeps the good ones', () => {
    localStorage.setItem(
      MY_ORDERS_KEY,
      JSON.stringify([
        { code: 'K7F2QX', token: 't', placedAt: 'x' },
        { code: 1, token: 't', placedAt: 'x' },
        { code: 'AAAAAA', token: 't2', placedAt: 'x', lastStatus: 5 },
        'junk',
      ]),
    );
    expect(readMyOrders().map((entry) => entry.token)).toEqual(['t']);
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(readMyOrders()).toEqual([]);
    expect(() => saveMyOrder(order())).not.toThrow();
    expect(() => rememberStatus(order())).not.toThrow();
    expect(isReturningCustomer()).toBe(false);
  });

  it('detects a returning customer from collected or delivered orders only', () => {
    saveMyOrder(order());
    expect(isReturningCustomer()).toBe(false);
    saveMyOrder(order({ token: 'tok-2', code: 'BBBBBB', status: 'cancelled' }));
    expect(isReturningCustomer()).toBe(false);
    saveMyOrder(order({ token: 'tok-3', code: 'CCCCCC', status: 'delivered' }));
    expect(isReturningCustomer()).toBe(true);
    rememberStatus(order({ status: 'collected' }));
    expect(readMyOrders().find((entry) => entry.token === 'tok-1')?.lastStatus).toBe('collected');
  });

  it('adds an order opened from a link, with nothing marked seen yet', () => {
    rememberStatus(order({ token: 'linked', code: 'DDDDDD' }));
    expect(readMyOrders()[0]).toMatchObject({ token: 'linked', lastStatus: 'ordered' });
    expect(readMyOrders()[0]?.lastSeenInboxAt).toBeUndefined();
  });

  it('shows an unseen dot only for inbox entries newer than the last one seen', () => {
    saveMyOrder(order());
    const saved = () => readMyOrders()[0];
    expect(hasUnseenUpdate(order(), saved())).toBe(false);
    const nudged = order({
      inbox: [
        { at: '2026-10-07T11:00:00.000Z', kind: 'nudge', textKey: 'nudge' },
        { at: '2026-10-07T10:00:00.000Z', kind: 'status', status: 'ordered' },
      ],
    });
    expect(hasUnseenUpdate(nudged, saved())).toBe(true);
    markInboxSeen(nudged);
    expect(hasUnseenUpdate(nudged, saved())).toBe(false);
    // Not saved on this phone yet: anything in the inbox is new.
    expect(hasUnseenUpdate(nudged, undefined)).toBe(true);
    expect(hasUnseenUpdate(order({ inbox: [] }), undefined)).toBe(false);
  });
});

describe('WhatsApp link', () => {
  it('opens the seller chat when the number is known, else the chat picker', () => {
    expect(whatsAppUrl('hi there', '61412345678')).toBe(
      'https://wa.me/61412345678?text=hi%20there',
    );
    expect(whatsAppUrl('hi there')).toBe('https://wa.me/?text=hi%20there');
    expect(whatsAppUrl(undefined, '61412345678')).toBe('https://wa.me/61412345678');
    expect(whatsAppUrl()).toBe('https://wa.me/');
  });

  it('builds the text from the order, with the address prompt for delivery', () => {
    const t = ((key: string, values?: Record<string, string>) =>
      `${key}${values ? JSON.stringify(values) : ''}`) as never;
    const text = buildWhatsAppText(order({ fulfilment: 'delivery' }), t, null);
    expect(text).toContain('wa.message');
    expect(text).toContain('2× Chicken lemper');
    expect(text).toContain('K7F-2QX');
    expect(text.endsWith('wa.addAddress')).toBe(true);
  });
});
