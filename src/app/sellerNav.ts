import type { IconName } from '../ui';

// The seller navigation (D-058, D-065): Home · Orders · Kitchen · Pickup & delivery · Menu · Settings
// on a tablet (plan 039: Home is the landing screen, Orders is /seller/orders); Orders · Pickup &
// delivery · More on a phone, which has no Home (D-057, D-067). Pure data, so it is tested without
// rendering.

export const NAV_IDS = [
  'home',
  'orders',
  'kitchen',
  'handover',
  'sell',
  'menu',
  'settings',
] as const;
export type NavId = (typeof NAV_IDS)[number];

const HELPER_NAV_IDS: ReadonlyArray<NavId> = ['orders', 'handover', 'sell'];

export const PHONE_NAV_IDS = ['orders', 'handover', 'more'] as const;
export type PhoneNavId = (typeof PHONE_NAV_IDS)[number];

export const HREF: Readonly<Record<NavId | 'more', string>> = {
  home: '/seller',
  orders: '/seller/orders',
  kitchen: '/seller/cook',
  handover: '/seller/hand-over',
  sell: '/seller/sell',
  menu: '/seller/menu',
  // Settings opens on its first pane (stage 10); the phone's More tab keeps /seller/more.
  settings: '/seller/settings/kitchen',
  more: '/seller/more',
};

/** The Home icon is not in the icon kit (src/ui): the rail draws this path itself. */
export const HOME_ICON_PATH = 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5';

export const ICON: Readonly<Record<Exclude<NavId, 'home'> | 'more', IconName>> = {
  orders: 'list',
  kitchen: 'pot',
  handover: 'box',
  sell: 'coin',
  menu: 'menu',
  settings: 'gear',
  more: 'dots',
};

type Role = 'seller' | 'chef' | 'helper' | undefined;

/**
 * Chefs see no Home (it starts and finishes menus, which only the owner does), no Sell (owners
 * and helpers sell on the day, plan 029) and no Settings (hidden, not greyed out). Menu is theirs
 * for their own dishes only (plan 030).
 * A helper (plan 028) sees Orders, Hand over and Sell only: no Home, Kitchen, Menu or Settings.
 */
export function navIdsFor(role: Role): ReadonlyArray<NavId> {
  if (role === 'helper') return HELPER_NAV_IDS;
  return role === 'chef'
    ? NAV_IDS.filter((id) => id !== 'home' && id !== 'settings' && id !== 'sell')
    : NAV_IDS;
}

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** A helper's one landing page, and where a link to anything else sends them. */
export const HELPER_HOME = '/seller/orders';

// The pages a helper may open (plan 028): Orders (one order, not New order), Hand over, Sell, and
// the phone's More and Devices. Anything else is turned back to Orders.
const HELPER_PATHS = [
  '/seller/orders',
  '/seller/hand-over',
  '/seller/sell',
  '/seller/more',
  '/seller/devices',
];

export function helperMayOpen(pathname: string): boolean {
  return HELPER_PATHS.some((path) => under(pathname.replace(/\/+$/, ''), path));
}

// Every page reached from the settings hub keeps Settings current.
const SETTINGS_PATHS = [
  '/seller/more',
  '/seller/settings',
  '/seller/week',
  '/seller/images',
  '/seller/chefs',
  '/seller/labels',
  '/seller/past-weeks',
  '/seller/backup',
  '/seller/devices',
];

export function activeNav(pathname: string): NavId {
  // Home is /seller itself; Orders (/seller/orders, one order, New order) and anything unknown is Orders.
  if (pathname.replace(/\/+$/, '') === '/seller') return 'home';
  if (under(pathname, '/seller/cook')) return 'kitchen';
  if (under(pathname, '/seller/hand-over') || under(pathname, '/seller/updates')) {
    return 'handover';
  }
  if (under(pathname, '/seller/sell')) return 'sell';
  // Share-menu belongs to making and sharing a menu.
  if (under(pathname, '/seller/menu') || under(pathname, '/seller/share')) return 'menu';
  if (SETTINGS_PATHS.some((path) => under(pathname, path))) return 'settings';
  return 'orders';
}

/** The phone bar has no Home (/seller is Orders there) and no Kitchen, Menu or Settings: those fold into More. */
export function activePhoneNav(pathname: string): PhoneNavId {
  const id = activeNav(pathname);
  if (id === 'home' || id === 'orders') return 'orders';
  if (id === 'handover') return id;
  return 'more';
}

// Phone: these routes say "Open this on a tablet or computer" (handoff, Layout shell → Phone).
// Kitchen and Labels are not here: they work on a phone (plan 035).
const TABLET_ONLY = [
  '/seller/menu',
  '/seller/share',
  '/seller/settings',
  '/seller/week',
  '/seller/images',
  '/seller/chefs',
  '/seller/past-weeks',
  '/seller/backup',
  '/seller/devices',
];

export function isTabletOnly(pathname: string): boolean {
  return TABLET_ONLY.some((path) => under(pathname, path));
}

// Task screens start with the banner shrunk to a strip: the wizard (Menu), Kitchen, Pickup &
// delivery and Settings. Home and Orders (and New order) keep the whole 5:1 banner.
export function isTaskScreen(pathname: string): boolean {
  const id = activeNav(pathname);
  return id !== 'orders' && id !== 'home';
}

/**
 * Plan 008: on Orders the page itself does not scroll, only the order list (and, on a tablet, the
 * order beside it). The phone has this on the list route only (/seller, its landing page, or
 * /seller/orders); one order and New order are pages of their own there. On a tablet /seller is
 * Home, which scrolls as a page.
 */
export function fixesPage(pathname: string, tablet: boolean): boolean {
  if (pathname === '/seller/orders') return true;
  if (pathname === '/seller') return !tablet;
  return tablet && (under(pathname, '/seller/new') || pathname.startsWith('/seller/orders/'));
}

/** The phone's Orders list: its landing page /seller or /seller/orders (its 3:1 banner sits on it). */
export function isPhoneOrdersList(pathname: string): boolean {
  return pathname === '/seller' || pathname === '/seller/orders';
}

/** Phone: one order and New order are full-screen tasks with their own pinned buttons, so the tab bar steps aside. */
export function hidesPhoneBar(pathname: string): boolean {
  return under(pathname, '/seller/new') || pathname.startsWith('/seller/orders/');
}
