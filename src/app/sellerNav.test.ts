import { describe, expect, it } from 'vitest';
import {
  activeNav,
  activePhoneNav,
  fixesPage,
  hidesPhoneBar,
  HREF,
  isPhoneOrdersList,
  isTabletOnly,
  isTaskScreen,
  helperMayOpen,
  navIdsFor,
  PHONE_NAV_IDS,
} from './sellerNav';

describe('navIdsFor', () => {
  it('gives the seller all nine items, Home first, Help right under Settings and About last', () => {
    expect(navIdsFor('seller')).toEqual([
      'home',
      'orders',
      'kitchen',
      'handover',
      'sell',
      'menu',
      'settings',
      'help',
      'about',
    ]);
    expect(HREF.sell).toBe('/seller/sell');
    expect(HREF.home).toBe('/seller');
    expect(HREF.orders).toBe('/seller/orders');
  });
  it('shows a helper Orders, Pickup & delivery and Sell only', () => {
    expect(navIdsFor('helper')).toEqual(['orders', 'handover', 'sell', 'help', 'about']);
  });
  it('shows a chef Menu (own dishes, plan 030) but not Home, Sell or Settings', () => {
    expect(navIdsFor('chef')).toEqual(['orders', 'kitchen', 'handover', 'menu', 'help', 'about']);
  });
});

describe('About (plan 075)', () => {
  it('is in the menu of every role, right under Help, at /seller/about', () => {
    for (const role of ['seller', 'chef', 'helper'] as const) {
      const ids = navIdsFor(role);
      expect(ids.indexOf('about')).toBe(ids.indexOf('help') + 1);
    }
    expect(HREF.about).toBe('/seller/about');
    expect(activeNav('/seller/about')).toBe('about');
    expect(helperMayOpen('/seller/about')).toBe(true);
    expect(fixesPage('/seller/about', false)).toBe(true);
    expect(fixesPage('/seller/about', true)).toBe(true);
  });
});

describe('activeNav', () => {
  it('marks Sell for /seller/sell', () => {
    expect(activeNav('/seller/sell')).toBe('sell');
  });

  it.each([
    ['/seller', 'home'],
    ['/seller/', 'home'],
    ['/seller/orders', 'orders'],
    ['/seller/orders/K7F2QX', 'orders'],
    ['/seller/new', 'orders'],
    ['/seller/cook', 'kitchen'],
    ['/seller/hand-over/pickup', 'handover'],
    ['/seller/updates', 'handover'],
    ['/seller/menu/items/new', 'menu'],
    ['/seller/share', 'menu'],
    ['/seller/more', 'settings'],
    ['/seller/devices', 'settings'],
  ])('%s is %s', (path, id) => {
    expect(activeNav(path)).toBe(id);
  });
});

describe('phone', () => {
  it('has Orders, Pickup & delivery and More', () => {
    expect(PHONE_NAV_IDS).toEqual(['orders', 'handover', 'more']);
  });
  it('folds Kitchen, Menu and Settings into More', () => {
    expect(activePhoneNav('/seller/cook')).toBe('more');
    expect(activePhoneNav('/seller/hand-over')).toBe('handover');
    // A phone has no Home: /seller is its Orders list.
    expect(activePhoneNav('/seller')).toBe('orders');
    expect(activePhoneNav('/seller/orders')).toBe('orders');
  });
  it('sends Menu and Settings pages to the tablet-only page, not the phone subset', () => {
    for (const path of ['/seller/menu', '/seller/menu/items/x', '/seller/backup']) {
      expect(isTabletOnly(path)).toBe(true);
    }
    for (const path of [
      '/seller',
      '/seller/orders/K7F2QX',
      '/seller/new',
      '/seller/more',
      '/seller/cook',
      '/seller/labels',
    ]) {
      expect(isTabletOnly(path)).toBe(false);
    }
    expect(isTabletOnly('/seller/hand-over/delivery')).toBe(false);
    expect(isTabletOnly('/seller/devices')).toBe(false);
  });
  it('lets a phone open Your dishes, and the wizard stays tablet-only (plan 051)', () => {
    expect(isTabletOnly('/seller/menu/dishes')).toBe(false);
    expect(isTabletOnly('/seller/menu', 'chef')).toBe(false);
    expect(isTabletOnly('/seller/menu', 'seller')).toBe(true);
    for (const path of [
      '/seller/menu/make/dishes',
      '/seller/menu/edit/details',
      '/seller/menu/sets',
    ]) {
      expect(isTabletOnly(path)).toBe(true);
      expect(isTabletOnly(path, 'chef')).toBe(true);
    }
  });
});

describe('isTaskScreen', () => {
  it('shrinks the banner on Kitchen, Pickup & delivery, Menu and Settings', () => {
    for (const path of ['/seller/cook', '/seller/hand-over', '/seller/menu', '/seller/more']) {
      expect(isTaskScreen(path)).toBe(true);
    }
  });
  it('keeps the whole banner on Home and Orders', () => {
    expect(isTaskScreen('/seller')).toBe(false);
    expect(isTaskScreen('/seller/orders')).toBe(false);
    expect(isTaskScreen('/seller/orders/K7F2QX')).toBe(false);
  });
});

describe('hidesPhoneBar', () => {
  it('hides the tab bar on one order and on New order only', () => {
    expect(hidesPhoneBar('/seller/orders/K7M2QX')).toBe(true);
    expect(hidesPhoneBar('/seller/new')).toBe(true);
    expect(hidesPhoneBar('/seller')).toBe(false);
    expect(hidesPhoneBar('/seller/hand-over')).toBe(false);
    expect(hidesPhoneBar('/seller/more')).toBe(false);
  });
});

describe('fixesPage', () => {
  it('fixes the page on the Orders list and one order, never on Home (a tablet at /seller)', () => {
    expect(fixesPage('/seller', true)).toBe(false);
    expect(fixesPage('/seller/orders', true)).toBe(true);
    expect(fixesPage('/seller/orders/K7F2QX', true)).toBe(true);
    expect(fixesPage('/seller/new', true)).toBe(true);
    expect(fixesPage('/seller/cook', true)).toBe(false);
  });
  it('on a phone /seller is the Orders list, so it is fixed there; one order is its own page', () => {
    expect(fixesPage('/seller', false)).toBe(true);
    expect(fixesPage('/seller/orders', false)).toBe(true);
    expect(fixesPage('/seller/orders/K7F2QX', false)).toBe(false);
    expect(isPhoneOrdersList('/seller')).toBe(true);
    expect(isPhoneOrdersList('/seller/orders')).toBe(true);
    expect(isPhoneOrdersList('/seller/cook')).toBe(false);
  });
});

describe('helperMayOpen', () => {
  it.each([
    ['/seller/orders', true],
    ['/seller/orders/K7F2QX', true],
    ['/seller/hand-over', true],
    ['/seller/sell', true],
    ['/seller/more', true],
    ['/seller', false],
    ['/seller/new', false],
    ['/seller/cook', false],
    ['/seller/menu', false],
    ['/seller/menu/make/1', false],
    ['/seller/settings/kitchen', false],
    ['/seller/share', false],
    ['/seller/labels', false],
    ['/seller/past-weeks', false],
    ['/seller/backup', false],
  ])('%s -> %s', (path, ok) => {
    expect(helperMayOpen(path)).toBe(ok);
  });
});
