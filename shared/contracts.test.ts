import { describe, expect, it } from 'vitest';
import { parseApiError } from './apiError';
import {
  parseResetResponse,
  parseSampleOrdersRequest,
  parseSampleOrdersResponse,
} from './devContract';
import { parseMenuResponse, parseSellerMenuResponse } from './menuContract';
import {
  parseCreateOrderRequest,
  parseOrder,
  parseSellerOrderResponse,
  parseSellerOrdersResponse,
  parseUpdateOrderRequest,
} from './orderContract';
import { parseSetPaidRequest, parseSetStatusRequest } from './sellerContract';

type Obj = Record<string, unknown>;

const text = { en: 'Rice', id: 'Nasi' };

const menu = {
  seller: { id: 's1', slug: 'onde-onde', name: 'Onde Onde' },
  kitchen: { sellerId: 's1', name: 'Delave', tagline: text },
  week: {
    cookingDate: '2026-10-10',
    cutoffAt: '2026-10-09T21:00:00+11:00',
    status: 'published',
    pickupPoints: [
      {
        id: 'p',
        place: 'Glen Waverley',
        directions: text,
        window: { start: '14:00', end: '17:00' },
      },
    ],
    delivery: { available: true, note: text },
  },
  ordering: { open: true },
  items: [
    {
      id: 'lemper',
      name: text,
      description: text,
      size: text,
      priceCents: 1000,
      limit: 20,
      remaining: 5,
      soldOut: false,
    },
    {
      id: 'rice',
      name: text,
      description: text,
      size: text,
      priceCents: 1500,
      remaining: null,
      soldOut: false,
    },
  ],
};

const order = {
  id: 'o1',
  sellerId: 's1',
  code: 'K7F2QX',
  token: 'abc',
  firstName: 'Rina',
  language: 'id',
  lines: [{ itemId: 'rice', name: text, size: text, priceCents: 1500, qty: 2 }],
  fulfilment: 'pickup',
  note: 'No chilli',
  status: 'confirmed',
  paid: false,
  locked: false,
  waReceived: true,
  returning: false,
  changed: false,
  inbox: [{ at: '2026-10-07T10:00:00Z', kind: 'status', status: 'confirmed' }],
  enteredBy: { role: 'seller', name: 'Bu Ani' },
  audit: [{ by: { role: 'seller', name: 'Bu Ani' }, what: 'created', at: '2026-10-07T10:00:00Z' }],
  createdAt: '2026-10-07T10:00:00Z',
  updatedAt: '2026-10-07T10:00:00Z',
};

/** A deep copy of `base` with `fn` applied. */
function mutate(base: unknown, fn: (draft: Obj) => void): unknown {
  const draft = structuredClone(base) as Obj;
  fn(draft);
  return draft;
}

const week = (d: Obj) => d['week'] as Obj;
const items = (d: Obj) => d['items'] as Array<Obj>;

const sellerMenu = mutate(menu, (d) => {
  d['chefs'] = [{ id: 'wati', sellerId: 'seller-onde-onde', name: 'Chef Wati' }];
  items(d)[0]!['chefId'] = 'wati';
});

describe('parseMenuResponse', () => {
  it('accepts a valid menu', () => {
    expect(parseMenuResponse(menu)).toEqual(menu);
  });

  it('carries the kitchen theme and the menu picture (stage 12)', () => {
    const withBoth = { ...(menu as Obj), theme: 'bali', pictureUrl: '/images/x.jpg' };
    expect(parseMenuResponse(withBoth)).toEqual(withBoth);
    expect(parseMenuResponse({ ...withBoth, theme: 'purple' })).toBeNull();
    expect(parseMenuResponse({ ...withBoth, pictureUrl: 3 })).toBeNull();
  });

  it('keeps pickupPlaceId on an order request', () => {
    const body = {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'rice', qty: 1 }],
      pickupPlaceId: 'place-1',
    };
    expect(parseCreateOrderRequest(body)).toMatchObject({ pickupPlaceId: 'place-1' });
  });

  it.each([
    ['null', null],
    ['no kitchen', mutate(menu, (d) => delete d['kitchen'])],
    ['an untranslated tagline', mutate(menu, (d) => (d['kitchen'] = { name: 'x', tagline: 'x' }))],
    ['a bad cut-off', mutate(menu, (d) => (week(d)['cutoffAt'] = 'soon'))],
    ['a bad week status', mutate(menu, (d) => (week(d)['status'] = 'open'))],
    ['a bad pickup time', mutate(menu, (d) => (week(d)['pickupPoints'] = [{ id: 'p' }]))],
    [
      'more than 10 items',
      mutate(menu, (d) => (d['items'] = Array.from({ length: 11 }, () => items(d)[1]))),
    ],
    ['a fractional price', mutate(menu, (d) => (items(d)[1]!['priceCents'] = 1.5))],
    ['a missing remaining', mutate(menu, (d) => delete items(d)[1]!['remaining'])],
    ['a chefs list (chef data leak)', mutate(menu, (d) => (d['chefs'] = []))],
    ['an item chefId (chef data leak)', mutate(menu, (d) => (items(d)[0]!['chefId'] = 'wati'))],
  ])('rejects %s', (_label, body) => {
    expect(parseMenuResponse(body)).toBeNull();
  });
});

describe('parseSellerMenuResponse', () => {
  it('accepts the menu with chefs and chef ids', () => {
    expect(parseSellerMenuResponse(sellerMenu)).toEqual(sellerMenu);
  });

  it.each([
    ['no chefs list', mutate(sellerMenu, (d) => delete d['chefs'])],
    ['a bad chef', mutate(sellerMenu, (d) => (d['chefs'] = [{ id: 'x' }]))],
    ['a non-string chefId', mutate(sellerMenu, (d) => (items(d)[0]!['chefId'] = 3))],
    ['a bad item', mutate(sellerMenu, (d) => (items(d)[1]!['priceCents'] = 1.5))],
  ])('rejects %s', (_label, body) => {
    expect(parseSellerMenuResponse(body)).toBeNull();
  });
});

describe('parseCreateOrderRequest', () => {
  const good = {
    firstName: ' Rina ',
    language: 'en',
    lines: [{ itemId: 'rice', qty: 2 }],
    fulfilment: 'delivery',
    note: ' hi ',
  };

  it('trims and accepts a valid request', () => {
    expect(parseCreateOrderRequest(good)).toEqual({
      firstName: 'Rina',
      language: 'en',
      lines: [{ itemId: 'rice', qty: 2 }],
      fulfilment: 'delivery',
      note: 'hi',
    });
  });

  it('drops an empty note', () => {
    expect(parseCreateOrderRequest({ ...good, note: '   ' })).not.toHaveProperty('note');
  });

  it.each([
    ['null', null],
    ['an empty name', { ...good, firstName: '  ' }],
    ['a 41-character name', { ...good, firstName: 'a'.repeat(41) }],
    ['a bad language', { ...good, language: 'fr' }],
    ['a bad fulfilment', { ...good, fulfilment: 'drone' }],
    ['no lines', { ...good, lines: [] }],
    ['a zero qty', { ...good, lines: [{ itemId: 'rice', qty: 0 }] }],
    ['a fractional qty', { ...good, lines: [{ itemId: 'rice', qty: 1.5 }] }],
    [
      'a duplicate item',
      {
        ...good,
        lines: [
          { itemId: 'rice', qty: 1 },
          { itemId: 'rice', qty: 1 },
        ],
      },
    ],
    ['a 201-character note', { ...good, note: 'n'.repeat(201) }],
    ['a non-string note', { ...good, note: 5 }],
  ])('rejects %s', (_label, body) => {
    expect(parseCreateOrderRequest(body)).toBeNull();
  });

  it('accepts exactly 40 and 200 characters', () => {
    const edge = { ...good, firstName: 'a'.repeat(40), note: 'n'.repeat(200) };
    expect(parseCreateOrderRequest(edge)).not.toBeNull();
  });
});

describe('parseUpdateOrderRequest', () => {
  it('accepts any one field, including an empty note', () => {
    expect(parseUpdateOrderRequest({ fulfilment: 'pickup' })).toEqual({ fulfilment: 'pickup' });
    expect(parseUpdateOrderRequest({ note: '' })).toEqual({ note: '' });
    expect(parseUpdateOrderRequest({ lines: [{ itemId: 'a', qty: 1 }] })).toEqual({
      lines: [{ itemId: 'a', qty: 1 }],
    });
  });

  it.each([
    ['null', null],
    ['an empty object', {}],
    ['bad fulfilment', { fulfilment: 'x' }],
    ['empty lines', { lines: [] }],
    ['a long note', { note: 'n'.repeat(201) }],
  ])('rejects %s', (_label, body) => {
    expect(parseUpdateOrderRequest(body)).toBeNull();
  });
});

describe('parseOrder and order responses', () => {
  it('accepts a valid order', () => {
    expect(parseOrder(order)).toEqual(order);
    expect(parseSellerOrderResponse({ order })).toEqual({ order });
    expect(parseSellerOrdersResponse({ orders: [order, order] })?.orders).toHaveLength(2);
  });

  it('accepts an order without note or enteredBy', () => {
    const plain = mutate(order, (d) => {
      delete d['note'];
      delete d['enteredBy'];
    });
    expect(parseOrder(plain)).toEqual(plain);
  });

  it.each([
    ['null', null],
    ['a bad status', mutate(order, (d) => (d['status'] = 'lost'))],
    ['a missing token', mutate(order, (d) => delete d['token'])],
    ['non-boolean paid', mutate(order, (d) => (d['paid'] = 'yes'))],
    [
      'a customer as enteredBy',
      mutate(order, (d) => (d['enteredBy'] = { role: 'customer', name: 'x' })),
    ],
    [
      '5 audit entries',
      mutate(order, (d) => {
        const entries = d['audit'] as Array<unknown>;
        d['audit'] = Array.from({ length: 5 }, () => entries[0]);
      }),
    ],
    ['a bad line', mutate(order, (d) => (d['lines'] = [{ itemId: 'x' }]))],
  ])('rejects %s', (_label, body) => {
    expect(parseOrder(body)).toBeNull();
  });

  it('rejects a bad envelope', () => {
    expect(parseSellerOrderResponse({})).toBeNull();
    expect(parseSellerOrdersResponse({ orders: [{}] })).toBeNull();
    expect(parseSellerOrdersResponse(null)).toBeNull();
  });
});

describe('seller contracts', () => {
  it('parses a status and a paid request', () => {
    expect(parseSetStatusRequest({ to: 'collected' })).toEqual({ to: 'collected' });
    expect(parseSetPaidRequest({ paid: true })).toEqual({ paid: true });
  });

  it.each([null, {}, { to: 'gone' }, { to: 5 }])('rejects status %j', (body) => {
    expect(parseSetStatusRequest(body)).toBeNull();
  });

  it.each([null, {}, { paid: 'yes' }, { paid: 1 }])('rejects paid %j', (body) => {
    expect(parseSetPaidRequest(body)).toBeNull();
  });
});

describe('dev contracts', () => {
  it('parses sample-orders and reset', () => {
    expect(parseSampleOrdersRequest({ count: 5 })).toEqual({ count: 5 });
    expect(parseSampleOrdersResponse({ added: 5 })).toEqual({ added: 5 });
    expect(parseResetResponse({ ok: true })).toEqual({ ok: true });
  });

  it.each([null, {}, { count: 0 }, { count: 201 }, { count: 1.5 }, { count: '5' }])(
    'rejects count %j',
    (body) => {
      expect(parseSampleOrdersRequest(body)).toBeNull();
    },
  );

  it('rejects bad responses', () => {
    expect(parseSampleOrdersResponse({ added: 'x' })).toBeNull();
    expect(parseResetResponse({ ok: false })).toBeNull();
  });
});

describe('parseApiError', () => {
  it('accepts a known code', () => {
    expect(parseApiError({ error: 'sold_out', message: 'No more' })).toEqual({
      error: 'sold_out',
      message: 'No more',
    });
  });

  it.each([null, {}, { error: 'boom', message: 'x' }, { error: 'sold_out' }])(
    'rejects %j',
    (body) => {
      expect(parseApiError(body)).toBeNull();
    },
  );
});
