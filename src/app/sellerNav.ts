import type { IconName } from '../ui';

// The seller navigation (D-058, D-065): Orders · Kitchen · Pickup & delivery · Menu · Settings on a
// tablet; Orders · Pickup & delivery · More on a phone (D-057, D-067). Pure data, so it is tested
// without rendering.

export const NAV_IDS = ['orders', 'kitchen', 'handover', 'menu', 'settings'] as const;
export type NavId = (typeof NAV_IDS)[number];

export const PHONE_NAV_IDS = ['orders', 'handover', 'more'] as const;
export type PhoneNavId = (typeof PHONE_NAV_IDS)[number];

export const HREF: Readonly<Record<NavId | 'more', string>> = {
  orders: '/seller',
  kitchen: '/seller/cook',
  handover: '/seller/hand-over',
  menu: '/seller/menu',
  // Settings opens on its first pane (stage 10); the phone's More tab keeps /seller/more.
  settings: '/seller/settings/kitchen',
  more: '/seller/more',
};

export const ICON: Readonly<Record<NavId | 'more', IconName>> = {
  orders: 'list',
  kitchen: 'pot',
  handover: 'box',
  menu: 'menu',
  settings: 'gear',
  more: 'dots',
};

type Role = 'seller' | 'chef' | undefined;

/** Chefs see no Menu and no Settings (hidden, not greyed out). */
export function navIdsFor(role: Role): ReadonlyArray<NavId> {
  return role === 'chef' ? NAV_IDS.filter((id) => id !== 'menu' && id !== 'settings') : NAV_IDS;
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

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export function activeNav(pathname: string): NavId {
  if (under(pathname, '/seller/cook')) return 'kitchen';
  if (under(pathname, '/seller/hand-over') || under(pathname, '/seller/updates')) {
    return 'handover';
  }
  // Share-menu belongs to making and sharing a menu.
  if (under(pathname, '/seller/menu') || under(pathname, '/seller/share')) return 'menu';
  if (SETTINGS_PATHS.some((path) => under(pathname, path))) return 'settings';
  return 'orders';
}

/** The phone bar has no Kitchen, Menu or Settings: those fold into More. */
export function activePhoneNav(pathname: string): PhoneNavId {
  const id = activeNav(pathname);
  if (id === 'orders' || id === 'handover') return id;
  return 'more';
}

// Phone: these routes say "Open this on a tablet or computer" (handoff, Layout shell → Phone).
const TABLET_ONLY = [
  '/seller/cook',
  '/seller/menu',
  '/seller/share',
  '/seller/settings',
  '/seller/week',
  '/seller/images',
  '/seller/chefs',
  '/seller/labels',
  '/seller/past-weeks',
  '/seller/backup',
  '/seller/devices',
];

export function isTabletOnly(pathname: string): boolean {
  return TABLET_ONLY.some((path) => under(pathname, path));
}

// Task screens start with the banner shrunk to a strip: the wizard (Menu), Kitchen, Pickup &
// delivery and Settings. Orders (and New order) keep the whole 5:1 banner.
export function isTaskScreen(pathname: string): boolean {
  return activeNav(pathname) !== 'orders';
}

/**
 * Plan 008: on the Orders home the page itself does not scroll, only the order list (and, on a
 * tablet, the order beside it). The phone has this on the list route only; one order and New order
 * are pages of their own there.
 */
export function fixesPage(pathname: string, tablet: boolean): boolean {
  if (pathname === '/seller') return true;
  return tablet && (under(pathname, '/seller/new') || pathname.startsWith('/seller/orders/'));
}

/** Phone: one order and New order are full-screen tasks with their own pinned buttons, so the tab bar steps aside. */
export function hidesPhoneBar(pathname: string): boolean {
  return under(pathname, '/seller/new') || pathname.startsWith('/seller/orders/');
}
