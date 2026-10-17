import { describe, expect, it } from 'vitest';
import type { SellerOrder } from '../../../shared/domain';
import { matches } from './parts';

// A Bluetooth scanner types the QR text and Enter into the focused search box (plan 084).
describe('hand-over search with a scanner', () => {
  const order = { code: 'AYSBXH', firstName: 'Rina' } as SellerOrder;
  it.each([
    'AYSBXH',
    'AYS-BXH',
    'aysbxh',
    'ays-bxh',
    'https://order.shaggybobo.app/o/AYSBXH',
    'https://order.shaggybobo.app/?order=AYS-BXH',
  ])('finds the order for "%s"', (scanned) => {
    expect(matches(order, scanned)).toBe(true);
  });

  it('does not find it for another code or link', () => {
    expect(matches(order, 'K7F-2QX')).toBe(false);
    expect(matches(order, 'https://order.shaggybobo.app/o/K7F2QX')).toBe(false);
  });
});
