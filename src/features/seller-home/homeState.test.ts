import { describe, expect, it } from 'vitest';
import type { Menu, MenuDishView, MenuView } from '../../../shared/menusContract';
import { agoOf, daysSince, freshness, homeStateOf, isRecent, liveStage } from './homeState';

const DAY = 86_400_000;

function menu(over: Partial<Menu> = {}): Menu {
  return {
    id: 'm1',
    state: 'not_published',
    cookingDate: '2026-10-17',
    cutoffAt: '2026-10-15T20:00:00+10:30',
    delivery: { available: false, note: { en: '', id: '' } },
    wizardStep: 0,
    takingOrders: true,
    placeUses: [],
    ...over,
  };
}
const dish = { id: 'd1' } as MenuDishView;
function view(over: Partial<Menu> = {}, dishes: Array<MenuDishView> = []): MenuView {
  return { menu: menu(over), dishes, pickupPoints: [] };
}
// Wed 14 Oct 2026, noon-ish in Adelaide.
const NOW = new Date('2026-10-14T01:00:00Z');

describe('homeStateOf', () => {
  it('1: a new kitchen (an untouched menu, no earlier menu) has never had a menu', () => {
    expect(homeStateOf({ view: view(), pastCount: 0, now: NOW })).toBe('noMenu');
  });
  it('1: also a menu deleted before it was ever published, with no earlier menu', () => {
    expect(homeStateOf({ view: view({ state: 'finished' }), pastCount: 0, now: NOW })).toBe(
      'noMenu',
    );
  });
  it('2: a menu that is not published, once something was done to it or there are earlier menus', () => {
    expect(homeStateOf({ view: view({ wizardStep: 1 }), pastCount: 0, now: NOW })).toBe('draft');
    expect(homeStateOf({ view: view({}, [dish]), pastCount: 0, now: NOW })).toBe('draft');
    expect(homeStateOf({ view: view(), pastCount: 3, now: NOW })).toBe('draft');
  });
  it('2: the first menu started from Home moves on in place', () => {
    expect(homeStateOf({ view: view(), pastCount: 0, started: true, now: NOW })).toBe('draft');
  });
  it('5-6: no live or unpublished menu, the last one finished', () => {
    const finished = view({ state: 'finished', publishedAt: '2026-10-01T00:00:00Z' }, [dish]);
    expect(homeStateOf({ view: finished, pastCount: 4, now: NOW })).toBe('quiet');
    // A deleted menu after earlier ones still shows the last finished one.
    expect(homeStateOf({ view: view({ state: 'finished' }), pastCount: 4, now: NOW })).toBe(
      'quiet',
    );
  });
  it('3 and 4: a live menu is taking, paused, closed or on its cooking day', () => {
    expect(homeStateOf({ view: view({ state: 'live' }), pastCount: 1, now: NOW })).toBe('taking');
  });
});

describe('liveStage', () => {
  const live = { cookingDate: '2026-10-17', cutoffAt: '2026-10-15T20:00:00+10:30' };
  it('taking before the cut-off', () => {
    expect(liveStage({ ...live, takingOrders: true }, NOW)).toBe('taking');
  });
  it('paused when Taking orders is off', () => {
    expect(liveStage({ ...live, takingOrders: false }, NOW)).toBe('paused');
  });
  it('closed from the cut-off until the cooking day', () => {
    const friday = new Date('2026-10-16T02:00:00Z');
    expect(liveStage({ ...live, takingOrders: true }, friday)).toBe('closed');
    // Closed wins over paused: the server closes ordering at the cut-off anyway.
    expect(liveStage({ ...live, takingOrders: false }, friday)).toBe('closed');
  });
  it('cooking day on the cooking date, and after it until the menu finishes', () => {
    const saturday = new Date('2026-10-17T00:30:00Z'); // Sat 11:00 in Adelaide
    expect(liveStage({ ...live, takingOrders: true }, saturday)).toBe('cookingDay');
    expect(liveStage({ ...live, takingOrders: false }, new Date('2026-10-18T05:00:00Z'))).toBe(
      'cookingDay',
    );
  });
  it("is the cooking day by the cook's date, not the device's", () => {
    // Fri 16 Oct 23:30 UTC is already Sat 17 Oct 10:00 in Adelaide.
    expect(liveStage({ ...live, takingOrders: true }, new Date('2026-10-16T23:30:00Z'))).toBe(
      'cookingDay',
    );
  });
});

describe('freshness of the last menu', () => {
  const finishedAt = '2026-10-10T12:00:00Z';
  const after = (days: number) => new Date(Date.parse(finishedAt) + days * DAY);
  it('is full when it just finished and empty after 14 days', () => {
    expect(freshness(finishedAt, after(0))).toBe(1);
    expect(freshness(finishedAt, after(7))).toBeCloseTo(0.5);
    expect(freshness(finishedAt, after(14))).toBe(0);
    expect(freshness(finishedAt, after(30))).toBe(0);
  });
  it('never goes above 1 for a time in the future', () => {
    expect(freshness(finishedAt, after(-1))).toBe(1);
    expect(daysSince(finishedAt, after(-1))).toBe(0);
  });
  it('uses the accent within 2 days and the muted look after', () => {
    expect(isRecent(finishedAt, after(1))).toBe(true);
    expect(isRecent(finishedAt, after(2))).toBe(true);
    expect(isRecent(finishedAt, after(2.5))).toBe(false);
    expect(isRecent(finishedAt, after(14))).toBe(false);
  });
  it('says today, yesterday, days and weeks', () => {
    expect(agoOf(finishedAt, after(0.5))).toEqual({ kind: 'today' });
    expect(agoOf(finishedAt, after(1.2))).toEqual({ kind: 'yesterday' });
    expect(agoOf(finishedAt, after(4))).toEqual({ kind: 'days', count: 4 });
    expect(agoOf(finishedAt, after(14))).toEqual({ kind: 'weeks', count: 2 });
  });
});
