import { describe, expect, it } from 'vitest';
import type { OrderStatus, SellerOrder } from '../../../shared/domain';
import { privateOrder, TODAY } from './testSupport';
import {
  canEditPrivate,
  createRequestOf,
  draftErrors,
  draftOf,
  draftStillToPay,
  draftTotalCents,
  dueCount,
  emptyDraft,
  groupByDate,
  orderStillToPay,
  showsDayDirections,
  stepsFor,
  stillToPayCents,
  totalCents,
  updateRequestOf,
  type PrivateDraft,
} from './model';

const at = (date: string, time: string | undefined, extra: Partial<SellerOrder> = {}) =>
  privateOrder({
    id: `${date}-${time ?? 'none'}`,
    code: `${date}${time ?? ''}`,
    private: { eventDate: date, ...(time ? { eventTime: time } : {}) },
    ...extra,
  });

describe('groupByDate', () => {
  it('groups Upcoming into Today, Tomorrow and later dates, soonest first, by time within a day', () => {
    const groups = groupByDate(
      [
        at('2026-10-30', '18:00'),
        at(TODAY, '16:30'),
        at('2026-10-18', '10:00'),
        at(TODAY, '12:00'),
        at(TODAY, undefined),
      ],
      TODAY,
      'upcoming',
    );
    expect(groups.map((group) => [group.date, group.label])).toEqual([
      [TODAY, 'today'],
      ['2026-10-18', 'tomorrow'],
      ['2026-10-30', null],
    ]);
    expect(groups[0]?.orders.map((order) => order.private?.eventTime)).toEqual([
      '12:00',
      '16:30',
      undefined,
    ]);
  });

  it('puts the latest first in Past and never labels a Past day Today or Tomorrow', () => {
    const groups = groupByDate(
      [
        at('2026-10-04', '11:30'),
        at('2026-10-09', '19:00'),
        at(TODAY, '12:00', { status: 'cancelled' }),
      ],
      TODAY,
      'past',
    );
    expect(groups.map((group) => group.date)).toEqual([TODAY, '2026-10-09', '2026-10-04']);
    expect(groups.every((group) => group.label === null)).toBe(true);
  });

  it('keeps a cancelled order in the group of its date, where the server put it (Past)', () => {
    const [group] = groupByDate(
      [at('2026-10-20', '09:00', { status: 'cancelled' })],
      TODAY,
      'past',
    );
    expect(group?.orders[0]?.status).toBe('cancelled');
  });

  it('is empty with no orders', () => {
    expect(groupByDate([], TODAY, 'upcoming')).toEqual([]);
  });
});

describe('the day-of Directions button', () => {
  it('shows for an open delivery order with a readable address on its event day', () => {
    expect(showsDayDirections(privateOrder(), TODAY)).toBe(true);
  });
  it.each<[string, Partial<SellerOrder>, string]>([
    ['a pickup order', { fulfilment: 'pickup' }, TODAY],
    ['another day', {}, '2026-10-16'],
    ['a cancelled order', { status: 'cancelled' }, TODAY],
    ['a delivered order', { status: 'delivered' }, TODAY],
    ['an address that cannot be read', { address: { unavailable: true } }, TODAY],
    ['no address', { address: undefined }, TODAY],
  ])('does not show for %s', (_name, extra, today) => {
    expect(showsDayDirections(privateOrder(extra), today)).toBe(false);
  });
});

describe('who may change an order', () => {
  it('is the owner only; chefs and helpers read it and move the status', () => {
    expect(canEditPrivate('seller')).toBe(true);
    expect(canEditPrivate('chef')).toBe(false);
    expect(canEditPrivate('helper')).toBe(false);
  });
});

describe('what is still to pay', () => {
  it('is the total minus the deposit, never below zero, and zero once paid', () => {
    expect(stillToPayCents(10000, false, 6400)).toBe(3600);
    expect(stillToPayCents(10000, false, undefined)).toBe(10000);
    expect(stillToPayCents(10000, false, 12000)).toBe(0);
    expect(stillToPayCents(10000, true, 6400)).toBe(0);
  });
  it('works out from an order', () => {
    const order = privateOrder();
    expect(totalCents(order)).toBe(6 * 1400 + 2 * 1000);
    expect(orderStillToPay(order)).toBe(10400 - 6400);
    expect(orderStillToPay(privateOrder({ paid: true }))).toBe(0);
  });
});

describe('the count on More', () => {
  it('adds today and tomorrow', () => {
    expect(dueCount({ today: 2, tomorrow: 1 })).toBe(3);
    expect(dueCount({ today: 0, tomorrow: 0 })).toBe(0);
  });
});

describe('the status steps', () => {
  it('end in Handed over for pickup and Delivered for delivery', () => {
    expect(stepsFor('pickup')).toEqual<Array<OrderStatus>>([
      'confirmed',
      'ready_for_pickup',
      'collected',
    ]);
    expect(stepsFor('delivery')).toEqual<Array<OrderStatus>>([
      'confirmed',
      'out_for_delivery',
      'delivered',
    ]);
  });
});

function filled(extra: Partial<PrivateDraft> = {}): PrivateDraft {
  return {
    ...emptyDraft(TODAY, 'en', 'home'),
    firstName: ' Rina ',
    street: 'Jl. Mawar 12',
    suburb: 'Sanur',
    lines: [
      { dishId: 'rice', qty: 6, price: '14.00' },
      { dishId: 'lemper', qty: 2, price: '10' },
    ],
    ...extra,
  };
}

describe('the editor draft', () => {
  it('starts on delivery, unpaid, today', () => {
    const draft = emptyDraft(TODAY, 'id', 'home');
    expect(draft).toMatchObject({
      fulfilment: 'delivery',
      paid: false,
      eventDate: TODAY,
      language: 'id',
      lines: [],
    });
  });

  it('asks for a name, at least one dish and, on delivery, a street', () => {
    expect(Object.keys(draftErrors(emptyDraft(TODAY, 'en', 'home'))).sort()).toEqual([
      'lines',
      'name',
      'street',
    ]);
    expect(draftErrors(filled())).toEqual({});
  });

  it('asks for a pickup place instead of an address on pickup', () => {
    expect(draftErrors(filled({ fulfilment: 'pickup', street: '', pickupPlaceId: '' }))).toEqual({
      place: true,
    });
    expect(
      draftErrors(filled({ fulfilment: 'pickup', street: '', pickupPlaceId: 'home' })),
    ).toEqual({});
  });

  it('checks the time, prices, deposit and date', () => {
    expect(draftErrors(filled({ eventTime: '25:00' })).time).toBe(true);
    expect(draftErrors(filled({ eventTime: '12:30' })).time).toBeUndefined();
    expect(draftErrors(filled({ lines: [{ dishId: 'rice', qty: 1, price: 'abc' }] })).price).toBe(
      true,
    );
    expect(draftErrors(filled({ deposit: '1.2.3' })).deposit).toBe(true);
    expect(draftErrors(filled({ eventDate: '' })).date).toBe(true);
  });

  it('refuses a deposit above the total, unless paid', () => {
    expect(draftErrors(filled({ deposit: '5000' })).depositOver).toBe(true);
    expect(draftErrors(filled({ deposit: '64' })).depositOver).toBeUndefined();
    expect(draftErrors(filled({ deposit: '5000', paid: true })).depositOver).toBeUndefined();
  });

  it('works out the total and what is still to pay as the deposit changes', () => {
    expect(draftTotalCents(filled())).toBe(10400);
    expect(draftStillToPay(filled())).toBe(10400);
    expect(draftStillToPay(filled({ deposit: '64' }))).toBe(4000);
    expect(draftStillToPay(filled({ deposit: '64.50' }))).toBe(3950);
    expect(draftStillToPay(filled({ deposit: '64', paid: true }))).toBe(0);
  });

  it('builds the create request: delivery with its address, prices in cents, a deposit', () => {
    expect(
      createRequestOf(filled({ eventTime: '12:00', deposit: '64', note: ' Less spicy ' })),
    ).toEqual({
      firstName: 'Rina',
      language: 'en',
      eventDate: TODAY,
      eventTime: '12:00',
      fulfilment: 'delivery',
      address: { street: 'Jl. Mawar 12', suburb: 'Sanur', postcode: '' },
      note: 'Less spicy',
      paid: false,
      depositCents: 6400,
      lines: [
        { dishId: 'rice', qty: 6, priceCents: 1400 },
        { dishId: 'lemper', qty: 2, priceCents: 1000 },
      ],
    });
  });

  it('builds a pickup request with its place and no address; paid drops the deposit', () => {
    const request = createRequestOf(
      filled({ fulfilment: 'pickup', pickupPlaceId: 'home', paid: true, deposit: '10' }),
    );
    expect(request).toMatchObject({ fulfilment: 'pickup', pickupPlaceId: 'home', paid: true });
    expect(request).not.toHaveProperty('address');
    expect(request).not.toHaveProperty('depositCents');
  });

  it('has no request while there is a problem', () => {
    expect(createRequestOf(emptyDraft(TODAY, 'en', 'home'))).toBeNull();
    expect(updateRequestOf(emptyDraft(TODAY, 'en', 'home'))).toBeNull();
  });

  it('builds the edit request with every field, clearing what was emptied', () => {
    expect(updateRequestOf(filled({ fulfilment: 'pickup', pickupPlaceId: 'home' }))).toMatchObject({
      eventTime: null,
      fulfilment: 'pickup',
      pickupPlaceId: 'home',
      address: null,
      note: '',
      depositCents: null,
    });
  });

  it('starts an edit from the order, price and deposit as typed text', () => {
    const draft = draftOf(privateOrder({ note: 'Birthday' }), 'home');
    expect(draft).toMatchObject({
      firstName: 'Rina',
      eventDate: TODAY,
      eventTime: '12:00',
      street: 'Jl. Mawar 12',
      suburb: 'Sanur',
      note: 'Birthday',
      deposit: '64.00',
      paid: false,
    });
    expect(draft.lines).toEqual([
      { dishId: 'rice', qty: 6, price: '14.00' },
      { dishId: 'lemper', qty: 2, price: '10.00' },
    ]);
  });
});
