import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link, NavigationType, Outlet, useLocation, useNavigationType } from 'react-router';
import { css, keyframes, styled } from 'styled-components';
import { isValidSlug } from '../../shared/seller';
import { lastKitchen } from '../api/device/lastKitchen';
import { manifestTarget, useManifestLinks } from '../components/install';
import { selectOrderPage, useUnseenUpdate } from '../features/customer-orders';
import { Icon, type IconName } from '../ui';

// The customer app's bottom tab bar (D-039): Menu · My orders · Settings, fixed to the bottom,
// icon above label, safe-area aware. Pages leave room for it through --customer-tabbar-height.
export type TabId = 'menu' | 'orders' | 'settings';

const TABS: ReadonlyArray<Readonly<{ id: TabId; href: string; icon: IconName }>> = [
  // Menu goes to the last seller menu this phone visited (D-037), else the home page.
  { id: 'menu', href: '/', icon: 'menu' },
  { id: 'orders', href: '/my-orders', icon: 'bag' },
  { id: 'settings', href: '/settings', icon: 'gear' },
];

/**
 * The Menu tab's address: the seller menu being shown, else the last one visited on this phone,
 * else `/`.
 */
export function menuTabHref(pathname: string): string {
  const first = pathname.split('/')[1] ?? '';
  const slug = isValidSlug(first) ? first : lastKitchen();
  return slug === null ? '/' : `/${slug}`;
}

/** The basket belongs to Menu; an order page, its confirmation and edit belong to My orders. */
export function activeTab(pathname: string): TabId {
  if (pathname.startsWith('/my-orders') || pathname.startsWith('/o/')) return 'orders';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'menu';
}

/**
 * Checkout pages (basket, pickup place, your name; also in change-order mode) hide the tab bar
 * (spec §3). So does the full-screen QR page (`/o/{token}/qr`).
 */
export function hasTabBar(pathname: string): boolean {
  return (
    !/^\/[^/]+\/basket(\/(pickup|name))?\/?$/.test(pathname) &&
    !/^\/o\/[^/]+\/edit(\/name)?\/?$/.test(pathname) &&
    !/^\/o\/[^/]+\/qr\/?$/.test(pathname)
  );
}

/** Root pages are the tabs' own pages; every other page is pushed on top of one. */
export function isRootPage(pathname: string): boolean {
  return pathname.split('/').filter(Boolean).length <= 1;
}

const TAB_HEIGHT = '3.5rem';
/** The space the bar takes at the bottom: pages leave it free. The fixtures page sets it too. */
export const TAB_BAR_HEIGHT = `calc(${TAB_HEIGHT} + var(--sab, 0px))`;
const MAX_WIDTH = '30rem'; // 480 px: phone width, centred on wider screens

const Wrap = styled.div<{ $tabs: boolean }>`
  --customer-tabbar-height: ${({ $tabs }) => ($tabs ? TAB_BAR_HEIGHT : '0px')};
  max-width: ${MAX_WIDTH};
  margin: 0 auto;
  overflow-x: clip; /* the sliding page starts off-screen */
  padding-bottom: var(--customer-tabbar-height);
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
}: Readonly<{ active: TabId; unseen: boolean; menuHref: string }>) {
  const { t } = useTranslation();
  return (
    <Bar aria-label={t('customerNav.label')}>
      <List>
        {TABS.map((tab) => (
          <Item key={tab.id}>
            <Tab
              to={tab.id === 'menu' ? menuHref : tab.href}
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
  const orderToken = /^\/o\/([^/]+)/.exec(pathname)?.[1];
  const orderSlug =
    orderPage.status === 'ready' && orderPage.order.token === orderToken
      ? orderPage.order.seller.slug
      : undefined;
  const target = manifestTarget(pathname, { orderSlug, lastSlug: lastKitchen() });
  useManifestLinks(target);
}

/** Wraps the customer pages with the tab bar. */
export function CustomerShell() {
  const { pathname } = useLocation();
  const unseen = useUnseenUpdate(pathname);
  useShellManifest(pathname);
  const navigationType = useNavigationType();
  const tabs = hasTabBar(pathname);
  return (
    <Wrap $tabs={tabs}>
      <Slide key={pathname} $push={navigationType === NavigationType.Push && !isRootPage(pathname)}>
        <Outlet />
      </Slide>
      {tabs ? (
        <CustomerTabBar
          active={activeTab(pathname)}
          unseen={unseen}
          menuHref={menuTabHref(pathname)}
        />
      ) : null}
    </Wrap>
  );
}
