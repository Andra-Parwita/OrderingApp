import { describe, expect, it } from 'vitest';
import { parseDevSellersResponse } from './devContract';
import type { SellerOrder } from './domain';
import { parseMenuResponse } from './menuContract';
import {
  parseCustomerOrder,
  parseOrder,
  toCustomerOrder,
  type CustomerOrderResponse,
} from './orderContract';
import { parseSettingsResponse } from './sellerContract';

const text = { en: 'a', id: 'b' };

const full: SellerOrder = {
  id: 'o1',
  sellerId: 's1',
  code: 'K7F2QX',
  token: 'tok',
  firstName: 'Rina',
  language: 'en',
  lines: [{ itemId: 'x', name: text, size: text, priceCents: 100, qty: 1 }],
  fulfilment: 'pickup',
  status: 'ordered',
  paid: false,
  locked: false,
  waReceived: false,
  returning: false,
  changed: false,
  inbox: [],
  audit: [],
  createdAt: '2026-10-07T10:00:00.000Z',
  updatedAt: '2026-10-07T10:00:00.000Z',
};

const seller = { slug: 'onde-onde', name: 'Onde Onde' };

describe('seller-scoped contracts', () => {
  it('a customer order carries its seller and nothing seller-only', () => {
    const customer = toCustomerOrder(full, seller);
    expect(customer.seller).toEqual(seller);
    expect(customer).not.toHaveProperty('sellerId');
    expect(parseCustomerOrder(customer)).toEqual(customer);
    const response: CustomerOrderResponse = { order: customer };
    expect(response.order.seller.slug).toBe('onde-onde');
  });

  it('rejects a customer order without a valid seller', () => {
    const customer = toCustomerOrder(full, seller);
    const without: Record<string, unknown> = { ...customer };
    delete without['seller'];
    expect(parseCustomerOrder(without)).toBeNull();
    expect(parseCustomerOrder({ ...customer, seller: { slug: 'Bad Slug', name: 'x' } })).toBeNull();
    expect(parseCustomerOrder({ ...customer, seller: { slug: 'api', name: 'x' } })).toBeNull();
  });

  it('a seller order needs its seller id', () => {
    expect(parseOrder(full)).toEqual(full);
    const without: Record<string, unknown> = { ...full };
    delete without['sellerId'];
    expect(parseOrder(without)).toBeNull();
    expect(parseOrder({ ...full, sellerId: '' })).toBeNull();
  });

  it('a menu needs a seller that matches its kitchen', () => {
    const base = {
      seller: { id: 's1', slug: 'onde-onde', name: 'Onde Onde' },
      kitchen: { sellerId: 's1', name: 'Onde Onde', tagline: text },
      week: {
        cookingDate: '2026-10-10',
        cutoffAt: '2026-10-09T21:00:00+11:00',
        status: 'published',
        pickupPoints: [],
        delivery: { available: false, note: text },
      },
      items: [],
      ordering: { open: true },
    };
    expect(parseMenuResponse(base)).not.toBeNull();
    expect(parseMenuResponse({ ...base, seller: undefined })).toBeNull();
    expect(
      parseMenuResponse({ ...base, seller: { id: 's2', slug: 'dapur-demo', name: 'D' } }),
    ).toBeNull();
    expect(parseMenuResponse({ ...base, kitchen: { name: 'x', tagline: text } })).toBeNull();
  });

  it('settings and dev seller responses carry ids and slugs', () => {
    const settings = {
      postGreeting: text,
      postClosing: text,
      orderingOpen: true,
    };
    expect(parseSettingsResponse({ sellerId: 's1', settings })).toEqual({
      sellerId: 's1',
      settings,
    });
    expect(parseSettingsResponse({ settings })).toBeNull();
    expect(
      parseDevSellersResponse({ sellers: [{ id: 's1', slug: 'onde-onde', name: 'Onde Onde' }] }),
    ).not.toBeNull();
    expect(
      parseDevSellersResponse({ sellers: [{ id: 's1', slug: 'Onde', name: 'Onde Onde' }] }),
    ).toBeNull();
  });
});
