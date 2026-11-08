import { describe, expect, it } from 'vitest';
import { menuFinishesAt } from './dates';
import {
  checkDeliveryDays,
  compareDeliveryDay,
  deliveryPlan,
  formatDayList,
  keepInRange,
  stripDays,
} from './deliveryDays';

const COOK = '2026-11-15'; // Sun
const D = (n: number) => stripDays(COOK)[n + 2] as string; // -2..+1

describe('delivery days (plan 126)', () => {
  it('the strip is 2 before, the event day and 1 after', () => {
    expect(stripDays(COOK)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']);
  });

  it('checks the ticked days: range, distinct, default among them, off clears', () => {
    expect(checkDeliveryDays(COOK, [D(-2), D(-1), D(0), D(1)], D(-1), true)).toEqual({
      days: [D(-2), D(-1), D(0), D(1)],
      defaultDay: D(-1),
    });
    expect(checkDeliveryDays(COOK, ['2026-11-12'], undefined, true)).toBeNull();
    expect(checkDeliveryDays(COOK, ['2026-11-17'], undefined, true)).toBeNull();
    expect(checkDeliveryDays(COOK, [D(0), D(0)], undefined, true)).toBeNull();
    expect(checkDeliveryDays(COOK, [D(1)], undefined, true)).toBeNull(); // default = event day, not ticked
    expect(checkDeliveryDays(COOK, [D(-1), D(1)], D(-1), true)).toEqual({
      days: [D(-1), D(1)],
      defaultDay: D(-1),
    });
    expect(checkDeliveryDays(COOK, [D(-1), D(0)], D(0), false)).toEqual({ days: [] });
  });

  it('only the event day ticked is stored as nothing', () => {
    expect(checkDeliveryDays(COOK, [D(0)], D(0), true)).toEqual({ days: [] });
  });

  it('the plan: nothing set is the event day alone, not custom', () => {
    expect(deliveryPlan(COOK, undefined)).toEqual({
      days: [COOK],
      defaultDay: COOK,
      custom: false,
    });
    expect(deliveryPlan(COOK, { days: [D(-1), D(1)], defaultDay: D(-1) })).toEqual({
      days: [D(-1), D(1)],
      defaultDay: D(-1),
      custom: true,
    });
  });

  it('keeps what is still in range when the cooking day moves, and a default among them', () => {
    expect(keepInRange('2026-11-17', [D(-2), D(0), D(1)], D(1))).toEqual({
      days: [D(0), D(1)],
      defaultDay: D(1),
    });
    expect(keepInRange('2026-11-30', [D(0)], undefined)).toEqual({ days: [] });
  });

  it('writes the days as one short list', () => {
    expect(formatDayList(['2026-11-14', '2026-11-16', '2026-11-17'], 'en')).toBe(
      'Sat 14, Mon 16, Tue 17 Nov',
    );
    expect(formatDayList(['2026-11-30', '2026-12-01'], 'en')).toBe('Mon 30 Nov, Tue 1 Dec');
  });

  it('sorts deliveries by day, earliest first, the same day keeps its order', () => {
    const orders = [
      { code: 'a', handoverDate: '2026-11-16' },
      { code: 'b' }, // event day
      { code: 'c', handoverDate: '2026-11-14' },
      { code: 'd' },
    ];
    expect([...orders].sort(compareDeliveryDay(COOK)).map((o) => o.code)).toEqual([
      'c',
      'b',
      'd',
      'a',
    ]);
  });

  it('the finish time: midnight after the latest day, one more with "keep open"', () => {
    const zone = 'Australia/Adelaide';
    expect(menuFinishesAt(COOK, zone)).toBe('2026-11-16T00:00:00+10:30');
    expect(menuFinishesAt(COOK, zone, [D(-1), D(1)])).toBe('2026-11-17T00:00:00+10:30');
    expect(menuFinishesAt(COOK, zone, [D(-1)])).toBe('2026-11-16T00:00:00+10:30');
    expect(menuFinishesAt(COOK, zone, [], true)).toBe('2026-11-17T00:00:00+10:30');
    expect(menuFinishesAt(COOK, zone, [D(1)], true)).toBe('2026-11-18T00:00:00+10:30');
  });
});
