import { describe, expect, it } from 'vitest';
import { parseCreateOrderRequest } from './orderContract';
import { parseOrderStats, parseStatsResponse } from './orderStats';

const ORDER = {
  firstName: 'Rina',
  language: 'en',
  fulfilment: 'pickup',
  lines: [{ itemId: 'pesmol', qty: 1 }],
};

describe('parseOrderStats (plan 121 B)', () => {
  it('keeps the four facts', () => {
    expect(parseOrderStats({ place: 'app', os: 'ios', push: true, remember: false })).toEqual({
      place: 'app',
      os: 'ios',
      push: true,
      remember: false,
    });
  });

  it('drops anything off the lists, one value at a time', () => {
    expect(parseOrderStats({ place: 'browser', os: 'windows', push: 1, remember: 'yes' })).toEqual({
      place: 'browser',
    });
    expect(parseOrderStats({ place: 'x', os: null })).toBeUndefined();
  });

  it('ignores extra keys (no names, ids or text can come through)', () => {
    expect(parseOrderStats({ os: 'other', firstName: 'Rina', note: 'hi' })).toEqual({
      os: 'other',
    });
  });

  it('is undefined for anything that is not an object', () => {
    for (const bad of ['text', 4, null, undefined, [], true]) {
      expect(parseOrderStats(bad)).toBeUndefined();
    }
  });
});

describe('an order request with stats', () => {
  it('carries valid facts', () => {
    expect(
      parseCreateOrderRequest({ ...ORDER, stats: { place: 'inapp', push: false } })?.stats,
    ).toEqual({
      place: 'inapp',
      push: false,
    });
  });

  it('is never refused because of bad stats (a lost sale is worse than a missing count)', () => {
    for (const stats of ['garbage', 7, [], null, { place: 'evil' }, { os: ['ios'] }]) {
      const parsed = parseCreateOrderRequest({ ...ORDER, stats });
      expect(parsed, JSON.stringify(stats)).not.toBeNull();
      expect(parsed?.stats).toBeUndefined();
    }
  });

  it('an old client sends none', () => {
    expect(parseCreateOrderRequest(ORDER)?.stats).toBeUndefined();
  });
});

describe('parseStatsResponse', () => {
  const week = {
    week: '2026-10-05',
    orders: 3,
    place: { app: 1, browser: 1, inapp: 0, unknown: 1 },
    os: { ios: 1, android: 1, other: 0, unknown: 1 },
    push: { on: 1, off: 1, unknown: 1 },
    remember: { on: 0, off: 2, unknown: 1 },
  };
  const kitchen = { sellerId: 's1', name: 'Onde', slug: 'onde', weeks: [week] };

  it('reads counts per kitchen and week', () => {
    expect(parseStatsResponse({ kitchens: [kitchen] })).toEqual({ kitchens: [kitchen] });
  });

  it('refuses a missing or negative count', () => {
    expect(
      parseStatsResponse({ kitchens: [{ ...kitchen, weeks: [{ ...week, place: { app: 1 } }] }] }),
    ).toBeNull();
    expect(
      parseStatsResponse({
        kitchens: [{ ...kitchen, weeks: [{ ...week, push: { on: -1, off: 0, unknown: 0 } }] }],
      }),
    ).toBeNull();
    expect(parseStatsResponse({})).toBeNull();
  });
});
