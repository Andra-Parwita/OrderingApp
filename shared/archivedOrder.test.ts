import { describe, expect, it } from 'vitest';
import {
  parseCustomerOrder,
  parseCustomerOrdersResponse,
  parseExpiredOrder,
  parseFetchedOrderResponse,
  toArchivedOrder,
  toExpiredOrder,
} from './orderContract';
import { keepsOrderDetails } from './pastWeeks';
import { API_ERROR_CODES } from './apiError';
import type { SellerOrder } from './domain';

const seller = { slug: 'onde-onde', name: 'Onde Onde' };

const order: SellerOrder = {
  id: 'o1',
  sellerId: 's1',
  code: 'ABC234',
  token: 'tok-1',
  firstName: 'Rina',
  language: 'en',
  lines: [
    {
      itemId: 'i1',
      name: { en: 'Soto', id: 'Soto' },
      size: { en: '1 portion', id: '1 porsi' },
      priceCents: 1400,
      qty: 2,
    },
  ],
  fulfilment: 'pickup',
  status: 'ordered',
  locked: false,
  inbox: [],
  createdAt: '2026-10-07T10:00:00Z',
  updatedAt: '2026-10-07T10:00:00Z',
  paid: false,
  waReceived: false,
  returning: false,
  changed: false,
  audit: [],
};

describe('archived order contract', () => {
  it('marks the customer view archived with the week date, and round-trips', () => {
    const archived = toArchivedOrder(order, seller, '2026-10-10');
    expect(archived).toMatchObject({ archived: true, cookingDate: '2026-10-10', token: 'tok-1' });
    expect(archived).not.toHaveProperty('sellerId');
    expect(parseCustomerOrder(JSON.parse(JSON.stringify(archived)))).toEqual(archived);
  });

  it('rejects archived without a valid date, and a date without archived', () => {
    const base = JSON.parse(JSON.stringify(toArchivedOrder(order, seller, '2026-10-10'))) as Record<
      string,
      unknown
    >;
    expect(parseCustomerOrder({ ...base, cookingDate: 'soon' })).toBeNull();
    expect(parseCustomerOrder({ ...base, archived: false })).toBeNull();
    expect(parseCustomerOrder({ ...base, archived: undefined })).toBeNull();
  });

  it('round-trips the expired summary and carries no items', () => {
    const expired = toExpiredOrder('tok-1', { slug: 'onde-onde', name: 'Onde Onde' }, '2026-10-10');
    expect(expired).toEqual({
      archived: true,
      expired: true,
      token: 'tok-1',
      seller,
      cookingDate: '2026-10-10',
    });
    expect(parseExpiredOrder(expired)).toEqual(expired);
    expect(parseExpiredOrder({ ...expired, expired: false })).toBeNull();
    expect(parseExpiredOrder({ ...expired, cookingDate: '10/10' })).toBeNull();
    expect(parseFetchedOrderResponse({ expired })).toEqual({ expired });
    expect(parseFetchedOrderResponse({ expired: { token: 'x' } })).toBeNull();
    expect(
      parseFetchedOrderResponse({ order: toArchivedOrder(order, seller, '2026-10-10') }),
    ).toMatchObject({ order: { archived: true } });
  });

  it('parses the list with and without expired entries', () => {
    expect(parseCustomerOrdersResponse({ orders: [] })).toEqual({ orders: [] });
    const expired = toExpiredOrder('tok-1', seller, '2026-10-10');
    expect(parseCustomerOrdersResponse({ orders: [], expired: [expired] })).toEqual({
      orders: [],
      expired: [expired],
    });
    expect(parseCustomerOrdersResponse({ orders: [], expired: [{}] })).toBeNull();
  });

  it('knows week_closed as an API error code', () => {
    expect(API_ERROR_CODES).toContain('week_closed');
  });

  it('keeps details for 28 days from the cooking date, exactly', () => {
    expect(keepsOrderDetails('2026-10-10', new Date('2026-11-06T23:59:59Z'))).toBe(true);
    expect(keepsOrderDetails('2026-10-10', new Date('2026-11-07T00:00:00Z'))).toBe(false);
  });
});
