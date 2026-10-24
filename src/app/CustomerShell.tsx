import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link, NavigationType, Outlet, useLocation, useNavigationType } from 'react-router';
import { css, keyframes, styled } from 'styled-components';
import { isValidSlug } from '../../shared/seller';
import { appKitchen, lastKitchen, rememberAppKitchen } from '../api/device/lastKitchen';
import { ShellOwnsBanner } from '../components/KitchenBanner';
import { pageFade } from '../components/statusBarFade';
import { manifestTarget, readEnvironment, useManifestLinks } from '../components/install';
import { useForcedKitchenLanguage } from '../features/customer-menu';
import { CustomerLiveHost, selectOrderPage, useUnseenUpdate } from '../features/customer-orders';
import { Icon, type IconName } from '../ui';
import { customerArea } from './customerPath';
import { SHELL_BANNER_HEIGHT, ShellBanner, useShellBanner } from './ShellBanner';
import { useKitchenTitle } from './useKitchenTitle';

// The customer app's bottom tab bar (D-039): Menu · My orders · Settings, fixed to the bottom,
// icon above label, safe-area aware. Pages leave room for it through --customer-tabbar-height.
export type TabId = 'menu' | 'orders' | 'settings';

const TABS: ReadonlyArray<Readonly<{ id: TabId; icon: IconName }>> = [
  { id: 'menu', icon: 'menu' },
  { id: 'orders', icon: 'bag' },
  { id: 'settings', icon: 'gear' },
];

/**
 * Where a tab leads. Menu goes to the last seller menu this phone visited (D-037), else the home page
 * (`menuHref`). My orders and Settings stay inside the kitchen the page or app belongs to (plan 102:
 * `/<slug>/my-orders`, `/<slug>/settings`); only on a page with no kitchen (`slug` null) are they the
 * slug-less pages.
 */
export function tabHref(id: TabId, menuHref: string, slug: string | null): string {
  if (id === 'menu') return menuHref;
  const page = id === 'orders' ? 'my-orders' : 'settings';
  return slug === null ? `/${page}` : `/${slug}/${page}`;
}

/**
 * The Menu tab's address: the seller menu being shown, else the last one visited on this phone,
 * else `/`.
 */
export function menuTabHref(pathname: string): string {
  const first = pathname.split('/')[1] ?? '';
  const slug = isValidSlug(first) ? first : lastKitchen();
  if (!readEnvironment().installed) return slug === null ? '/' : `/${slug}`;
  // A home-screen app (plan 068): the kitchen it was launched on stays its Menu.
  const own = appKitchen();
  if (own !== null) return `/${own}`;
  if (isValidSlug(first)) rememberAppKitchen(first);
  return slug === null ? '/' : `/${slug}`;
}

/** The basket belongs to Menu; an order page, its confirmation and edit belong to My orders. */
export function activeTab(pathname: string): TabId {
  const { kind } = customerArea(pathname);
  if (kind === 'orders' || kind === 'order') return 'orders';
  return kind === 'settings' ? 'settings' : 'menu';
}

/**
 * Checkout pages (basket, pickup place, your name; also in change-order mode) hide the tab bar
 * (spec §3). So does the full-screen QR page (`/<slug>/o/{token}/qr`, or the old `/o/{token}/qr`).
 */
export function hasTabBar(pathname: string): boolean {
  const { kind, sub } = customerArea(pathname);
  const path = sub.join('/');
  if (kind === 'kitchen') return !/^basket(\/(pickup|name))?$/.test(path);
  if (kind === 'order') return !/^(edit(\/name)?|qr)$/.test(path);
  return true;
}

/** Root pages are the tabs' own pages; every other page is pushed on top of one. */
export function isRootPage(pathname: string): boolean {
  const { kind, sub } = customerArea(pathname);
  if (kind === 'order') return false;
  return kind === 'other' ? sub.length <= 1 : sub.length === 0;
}

const TAB_HEIGHT = '3.5rem';
/** The space the bar takes at the bottom: pages leave it free. The fixtures page sets it too. */
export const TAB_BAR_HEIGHT = `calc(${TAB_HEIGHT} + var(--sab, 0px))`;
const MAX_WIDTH = '30rem'; // 480 px: phone width, centred on wider screens

// Plan 122: in an iPhone home-screen app the page runs under the status bar (--sat > 0, else 0). With a
// banner, the banner's own safe-area band covers it; without one, the shell pads the page down by --sat.
// Either way the shell draws one fixed thin fade behind the clock, so it reads after the banner scrolls away.
// Plan 123: while a tall banner is on screen the thin fade stays off, so it never darkens the picture.
const Wrap = styled.div<{ $tabs: boolean; $banner: boolean; $fade: boolean }>`
  --customer-tabbar-height: ${({ $tabs }) => ($tabs ? TAB_BAR_HEIGHT : '0px')};
  /* The banner above the page (plan 093): pages take it off their minimum height. */
  --customer-banner-height: ${({ $banner }) => ($banner ? SHELL_BANNER_HEIGHT : 'var(--sat)')};
  max-width: ${MAX_WIDTH};
  margin: 0 auto;
  overflow-x: clip; /* the sliding page starts off-screen */
  padding-top: ${({ $banner }) => ($banner ? '0px' : 'var(--sat)')};
  padding-bottom: var(--customer-tabbar-height);
  ${({ $fade }) => ($fade ? pageFade : '')}
`;
const slideIn = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;
// A page pushed on top slides in from the right. Reduced motion: GlobalStyle turns every
// animation off, so the page just appears.
const Slide = styled.div<{ $push: boolean }>`
  animation: ${({ $push }) =>
    $push
      ? css`
          ${slideIn} 240ms ease-out
        `
      : 'none'};
`;
const Bar = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  width: 100%;
  max-width: ${MAX_WIDTH};
  margin: 0 auto;
  padding-bottom: var(--sab, 0rem);
  background: ${({ theme }) => theme.colour.bg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const List = styled.ul`
  display: flex;
  max-width: ${MAX_WIDTH};
  margin: 0 auto;
  padding: 0;
  list-style: none;
`;
const Item = styled.li`
  flex: 1;
`;
const Tab = styled(Link)<{ $active: boolean }>`
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${TAB_HEIGHT};
  color: ${({ theme, $active }) => ($active ? theme.c.atext : theme.colour.textMuted)};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme, $active }) =>
    $active ? theme.type.weight.strong : theme.type.weight.regular};
  text-decoration: none;

  /* The active tab is also marked by a bar above its icon: never colour alone. */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    width: 2rem;
    height: 0.1875rem;
    border-radius: 0 0 0.1875rem 0.1875rem;
    background: ${({ theme, $active }) => ($active ? theme.c.atext : 'transparent')};
  }

  &:focus-visible {
    outline-offset: -${({ theme }) => theme.border.focus};
  }
`;
const IconBox = styled.span`
  position: relative;
  display: inline-flex;
`;
const Dot = styled.span`
  position: absolute;
  top: -0.125rem;
  right: -0.25rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colour.accent};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.bg};
`;
const Hidden = styled.span`
  position: absolute;
  width: ${({ theme }) => theme.border.hairline};
  height: ${({ theme }) => theme.border.hairline};
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;

/** The bar itself; the shell and the fixtures page both show it. */
export function CustomerTabBar({
  active,
  unseen,
  menuHref,
  slug = null,
}: Readonly<{ active: TabId; unseen: boolean; menuHref: string; slug?: string | null }>) {
  const { t } = useTranslation();
  return (
    <Bar aria-label={t('customerNav.label')}>
      <List>
        {TABS.map((tab) => (
          <Item key={tab.id}>
            <Tab
              to={tabHref(tab.id, menuHref, slug)}
              $active={tab.id === active}
              aria-current={tab.id === active ? 'page' : undefined}
            >
              <IconBox>
                <Icon name={tab.icon} />
                {tab.id === 'orders' && unseen ? <Dot aria-hidden="true" /> : null}
              </IconBox>
              <span>{t(`customerNav.${tab.id}`)}</span>
              {tab.id === 'orders' && unseen ? (
                <Hidden>{`, ${t('customerNav.newUpdate')}`}</Hidden>
              ) : null}
            </Tab>
          </Item>
        ))}
      </List>
    </Bar>
  );
}

/**
 * Points the page's web app manifest (and the iPhone icon) at the kitchen being shown, so "Add to
 * Home Screen" installs that kitchen, opening on the page the customer is on (spec 6.4).
 */
function useShellManifest(pathname: string): void {
  const orderPage = useSelector(selectOrderPage);
  const orderToken = customerArea(pathname).token;
  const orderSlug =
    orderPage.status === 'ready' && orderPage.order.token === orderToken
      ? orderPage.order.seller.slug
      : undefined;
  const target = manifestTarget(pathname, { orderSlug, lastSlug: lastKitchen() });
  useManifestLinks(target);
}

/**
 * The kitchen the My orders and Settings tabs stay in: a home-screen app belongs to one (the kitchen it
 * was launched on, else the page's); a browser tab uses the kitchen in the address, so a link for one
 * kitchen never lands on another's pages. My orders still lists every kitchen there (plan 102, Q3).
 * Slug-less pages (`/my-orders`, `/settings`, `/`) have no kitchen and stay slug-less.
 */
function tabKitchen(pathname: string): string | null {
  const pageKitchen = customerArea(pathname).slug;
  if (!readEnvironment().installed) return pageKitchen;
  return appKitchen() ?? pageKitchen;
}

/** Wraps the customer pages with the tab bar. */
export function CustomerShell() {
  const { pathname } = useLocation();
  const unseen = useUnseenUpdate();
  useShellManifest(pathname);
  useForcedKitchenLanguage();
  const navigationType = useNavigationType();
  // The window scrolls (D-114): a new page starts at the top; Back keeps the browser's own restore.
  useLayoutEffect(() => {
    if (navigationType === NavigationType.Push) window.scrollTo(0, 0);
  }, [pathname, navigationType]);
  const tabs = hasTabBar(pathname);
  const banner = useShellBanner(pathname);
  const hasBanner = banner.kind !== 'none';
  useKitchenTitle(pathname, banner.kind === 'kitchen' ? banner.kitchen.name : null);
  const [tallInView, setTallInView] = useState(false);
  return (
    <Wrap $tabs={tabs} $banner={hasBanner} $fade={!tallInView}>
      <CustomerLiveHost />
      <ShellBanner state={banner} onTallInView={setTallInView} />
      <Slide key={pathname} $push={navigationType === NavigationType.Push && !isRootPage(pathname)}>
        <ShellOwnsBanner.Provider value={hasBanner}>
          <Outlet />
        </ShellOwnsBanner.Provider>
      </Slide>
      {tabs ? (
        <CustomerTabBar
          active={activeTab(pathname)}
          unseen={unseen}
          menuHref={menuTabHref(pathname)}
          slug={tabKitchen(pathname)}
        />
      ) : null}
    </Wrap>
  );
}
