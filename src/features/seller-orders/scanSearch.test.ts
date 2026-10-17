import { describe, expect, it } from 'vitest';
import { makeOrder } from './testSupport';
import { matchesQuery } from './sellerOrdersSelectors';

// A Bluetooth scanner types the QR text and Enter into the focused search box (plan 084).
describe('orders search with a scanner', () => {
  const order = makeOrder({ code: 'AYSBXH', firstName: 'Rina' });
  it.each([
    'AYSBXH',
    'AYS-BXH',
    'aysbxh',
    'ays-bxh',
    'https://order.shaggybobo.app/o/AYSBXH',
    'https://order.shaggybobo.app/?order=AYS-BXH',
  ])('finds the order for "%s"', (scanned) => {
    expect(matchesQuery(order, scanned)).toBe(true);
  });

  it('does not find it for another code', () => {
    expect(matchesQuery(order, 'https://order.shaggybobo.app/o/K7F2QX')).toBe(false);
  });
});
