import { describe, expect, it } from 'vitest';
import type { SellerOrder } from '../../../shared/domain';
import { mergeOrders } from './HandOverScreen';

// Plan 126: Pickup & delivery lists deliveries by delivery day.

describe('delivery list sort', () => {
  const order = (code: string, handoverDate?: string) =>
    ({ code, fulfilment: 'delivery', ...(handoverDate ? { handoverDate } : {}) }) as SellerOrder;

  it('goes by delivery day, earliest first; the same day keeps its order', () => {
    const list = mergeOrders(
      [order('a', '2026-11-16'), order('b'), order('c', '2026-11-14'), order('d')],
      [],
      'delivery',
      '2026-11-15',
    );
    expect(list.map((o) => o.code)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('without delivery days the order is exactly as before', () => {
    const list = mergeOrders([order('x'), order('y'), order('z')], [], 'delivery', '2026-11-15');
    expect(list.map((o) => o.code)).toEqual(['x', 'y', 'z']);
  });
});
