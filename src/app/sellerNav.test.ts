import { describe, expect, it } from 'vitest';
import {
  activeNav,
  activePhoneNav,
  hidesPhoneBar,
  isTabletOnly,
  isTaskScreen,
  navIdsFor,
  PHONE_NAV_IDS,
} from './sellerNav';

describe('navIdsFor', () => {
  it('gives the seller all five items, in order', () => {
    expect(navIdsFor('seller')).toEqual(['orders', 'kitchen', 'handover', 'menu', 'settings']);
  });
  it('hides Menu and Settings from a chef', () => {
    expect(navIdsFor('chef')).toEqual(['orders', 'kitchen', 'handover']);
  });
});

describe('activeNav', () => {
  it.each([
    ['/seller', 'orders'],
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
    expect(activePhoneNav('/seller')).toBe('orders');
  });
  it('sends Kitchen, Menu and Settings pages to the tablet-only page, not the phone subset', () => {
    for (const path of ['/seller/cook', '/seller/menu', '/seller/menu/items/x', '/seller/backup']) {
      expect(isTabletOnly(path)).toBe(true);
    }
    for (const path of ['/seller', '/seller/orders/K7F2QX', '/seller/new', '/seller/more']) {
      expect(isTabletOnly(path)).toBe(false);
    }
    expect(isTabletOnly('/seller/hand-over/delivery')).toBe(false);
  });
});

describe('isTaskScreen', () => {
  it('shrinks the banner on Kitchen, Pickup & delivery, Menu and Settings', () => {
    for (const path of ['/seller/cook', '/seller/hand-over', '/seller/menu', '/seller/more']) {
      expect(isTaskScreen(path)).toBe(true);
    }
  });
  it('keeps the whole banner on Orders', () => {
    expect(isTaskScreen('/seller')).toBe(false);
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
