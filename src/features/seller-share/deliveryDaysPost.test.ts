import { describe, expect, it } from 'vitest';
import { buildShareText } from './shareText';
import { MENU, SETTINGS } from './testSupport';

// Plan 126: the menu post names the extra delivery days in one line; no extra days, no line.
const ORIGIN = 'https://orders.example';
const SLUG = 'onde-onde';
// MENU cooks on Sat 10 Oct.
const withDelivery = (delivery: Partial<(typeof MENU)['delivery']>) => ({
  ...MENU,
  delivery: { ...MENU.delivery, available: true, ...delivery },
});

describe('delivery days in the post (plan 126)', () => {
  it('adds one line naming the other days', () => {
    const text = buildShareText(
      withDelivery({ days: ['2026-10-09', '2026-10-10', '2026-10-11'] }),
      SETTINGS,
      'en',
      ORIGIN,
      SLUG,
    );
    expect(text).toContain('Delivery also Fri 9, Sun 11 Oct');
    expect(text.match(/Delivery also/g)).toHaveLength(1);
  });

  it('is in Indonesian too', () => {
    const text = buildShareText(
      withDelivery({ days: ['2026-10-09', '2026-10-10'] }),
      SETTINGS,
      'id',
      ORIGIN,
      SLUG,
    );
    expect(text).toContain('Antar juga Jumat 9 Okt');
  });

  it('names all the days when the cooking day itself is not a delivery day', () => {
    const text = buildShareText(
      withDelivery({ days: ['2026-10-09', '2026-10-11'], defaultDay: '2026-10-09' }),
      SETTINGS,
      'en',
      ORIGIN,
      SLUG,
    );
    expect(text).toContain('Delivery on Fri 9, Sun 11 Oct');
  });

  it('no extra days: exactly the post of today', () => {
    expect(buildShareText(withDelivery({}), SETTINGS, 'en', ORIGIN, SLUG)).toBe(
      buildShareText(MENU, SETTINGS, 'en', ORIGIN, SLUG),
    );
    expect(buildShareText(withDelivery({}), SETTINGS, 'en', ORIGIN, SLUG)).not.toContain(
      'Delivery also',
    );
  });
});
