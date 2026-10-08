import { describe, expect, it } from 'vitest';
import type { Fulfilment, OrderStatus } from './domain';
import { isFinalStatus, nextStatuses, ORDER_STATUSES } from './status';

describe('nextStatuses', () => {
  const cases: Array<[OrderStatus, Fulfilment, Array<OrderStatus>]> = [
    ['ordered', 'pickup', ['confirmed', 'cancelled']],
    ['ordered', 'delivery', ['confirmed', 'cancelled']],
    ['confirmed', 'pickup', ['ready_for_pickup', 'cancelled']],
    ['confirmed', 'delivery', ['out_for_delivery', 'cancelled']],
    ['ready_for_pickup', 'pickup', ['collected', 'cancelled']],
    ['out_for_delivery', 'delivery', ['delivered', 'cancelled']],
    ['collected', 'pickup', []],
    ['delivered', 'delivery', []],
    ['cancelled', 'pickup', []],
  ];

  it.each(cases)('%s (%s) can go to %j', (status, fulfilment, expected) => {
    expect(nextStatuses({ status, fulfilment })).toEqual(expected);
  });

  it('covers every status for both fulfilments, and cancel exactly when not final', () => {
    for (const status of ORDER_STATUSES) {
      for (const fulfilment of ['pickup', 'delivery'] as const) {
        const next = nextStatuses({ status, fulfilment });
        expect(next.includes('cancelled')).toBe(!isFinalStatus(status));
      }
    }
  });
});
