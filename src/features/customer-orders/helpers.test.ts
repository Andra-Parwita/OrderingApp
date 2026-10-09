import { describe, expect, it } from 'vitest';
import type { CustomerOrder, OrderStatus } from '../../../shared/domain';
import { inboxNewestFirst, inboxText, isThisWeek, timelineSteps } from './helpers';

const states = (status: OrderStatus, fulfilment: 'pickup' | 'delivery') =>
  timelineSteps(status, fulfilment).map((step) => `${step.status}:${step.state}`);

describe('timelineSteps', () => {
  it.each([
    ['ordered', ['ordered:current', 'confirmed:todo', 'ready_for_pickup:todo', 'collected:todo']],
    ['confirmed', ['ordered:done', 'confirmed:current', 'ready_for_pickup:todo', 'collected:todo']],
    [
      'ready_for_pickup',
      ['ordered:done', 'confirmed:done', 'ready_for_pickup:current', 'collected:todo'],
    ],
    ['collected', ['ordered:done', 'confirmed:done', 'ready_for_pickup:done', 'collected:done']],
  ] as const)('pickup, %s', (status, expected) => {
    expect(states(status, 'pickup')).toEqual(expected);
  });

  it.each([
    ['confirmed', ['ordered:done', 'confirmed:current', 'out_for_delivery:todo', 'delivered:todo']],
    [
      'out_for_delivery',
      ['ordered:done', 'confirmed:done', 'out_for_delivery:current', 'delivered:todo'],
    ],
    ['delivered', ['ordered:done', 'confirmed:done', 'out_for_delivery:done', 'delivered:done']],
  ] as const)('delivery, %s', (status, expected) => {
    expect(states(status, 'delivery')).toEqual(expected);
  });

  it('shows a cancelled order as Ordered then Cancelled', () => {
    expect(states('cancelled', 'pickup')).toEqual(['ordered:done', 'cancelled:current']);
  });
});

describe('inboxText', () => {
  it('prefers the seller text, then the key, then the status', () => {
    expect(inboxText({ at: 'x', kind: 'message', text: 'See you at 2' })).toEqual({
      kind: 'own',
      text: 'See you at 2',
    });
    expect(inboxText({ at: 'x', kind: 'nudge', textKey: 'nudgeReturning' })).toEqual({
      kind: 'key',
      key: 'inbox.nudgeReturning',
      minutes: 0,
    });
    expect(inboxText({ at: 'x', kind: 'status', status: 'confirmed', minutes: 15 })).toEqual({
      kind: 'key',
      key: 'inbox.status.confirmed',
      minutes: 15,
    });
    expect(inboxText({ at: 'x', kind: 'message' })).toMatchObject({ key: 'inbox.other' });
  });

  it('sorts newest first', () => {
    const sorted = inboxNewestFirst([
      { at: '2026-10-07T10:00:00.000Z', kind: 'status' },
      { at: '2026-10-09T10:00:00.000Z', kind: 'status' },
      { at: '2026-10-08T10:00:00.000Z', kind: 'status' },
    ]);
    expect(sorted.map((entry) => entry.at.slice(8, 10))).toEqual(['09', '08', '07']);
  });
});

describe('isThisWeek', () => {
  const base = { status: 'confirmed', createdAt: '2026-10-07T10:00:00.000Z' } as CustomerOrder;
  const now = new Date('2026-10-09T14:30:00Z'); // Sat 10 Oct 01:30 in Melbourne
  it('counts an order for the coming cooking date as current, early on the Saturday', () => {
    expect(isThisWeek(base, '2026-10-17', now)).toBe(true);
  });
  it('counts an order cooking before today as earlier', () => {
    expect(isThisWeek(base, '2026-10-03', now)).toBe(false);
  });
  it('counts an order cooking today as current', () => {
    expect(isThisWeek(base, '2026-10-10', now)).toBe(true);
  });
  it('falls back to "not finished" without the menu', () => {
    expect(isThisWeek(base, null)).toBe(true);
    expect(isThisWeek({ ...base, status: 'collected' }, null)).toBe(false);
  });
});
