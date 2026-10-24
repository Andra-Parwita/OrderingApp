import { useState } from 'react';
import { useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Kitchen } from '../../shared/domain';
import { isValidSlug } from '../../shared/seller';
import { readMyOrders } from '../api/device/myOrders';
import { lastKitchen } from '../api/device/lastKitchen';
import { KitchenBanner } from '../components/KitchenBanner';
import { ownKitchen } from '../components/install';
import { bannerFade } from '../components/statusBarFade';
import {
  selectKitchenMissing,
  selectMenu,
  selectMenuSlug,
  useLang,
  type CustomerRootState,
} from '../features/customer-menu';
import { selectMenus, selectOrderPage } from '../features/customer-orders';
import { customerArea } from './customerPath';

// The kitchen banner of every customer page that belongs to a kitchen (plans 093, 094). It lives in the shell,
// outside the sliding page, so a page change never remounts it (an iPhone paints a fresh <img>
// blank first). Once a kitchen's banner has shown, it stays until another kitchen's is ready.

type Kept = Readonly<{ slug: string; kitchen: Kitchen }>;
type Wanted =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'pending'; slug: string | null }>
  | Readonly<{ kind: 'ready'; slug: string; kitchen: Kitchen }>;

export type ShellBannerState =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'skeleton' }>
  | Readonly<{ kind: 'kitchen'; kitchen: Kitchen }>;

/** The banner's height: the 3 / 1 picture over the page width (30rem at most) and the notch. */
export const SHELL_BANNER_HEIGHT = 'calc(min(100vw, 30rem) / 3 + var(--sat))';

const NONE: Wanted = { kind: 'none' };

const BannerSkeleton = styled.div`
  height: ${SHELL_BANNER_HEIGHT};
  background: ${({ theme }) => theme.c.surf2};
  ${bannerFade}
`;

/** The kitchen's slug for the order page at `/<slug>/o/:token…` (or the old `/o/:token…`): the loaded order's, else the saved one's. */
function orderSlug(orderPage: ReturnType<typeof selectOrderPage>, token: string): string | null {
  if (
    (orderPage.status === 'ready' || orderPage.status === 'expired') &&
    orderPage.order.token === token
  ) {
    return orderPage.order.seller.slug;
  }
  return readMyOrders().find((saved) => saved.token === token)?.sellerSlug ?? null;
}

/** Which banner the page at this address wants, from what the store already holds. */
function useWanted(pathname: string): Wanted {
  const menu = useSelector(selectMenu);
  const menuSlug = useSelector(selectMenuSlug);
  const menus = useSelector(selectMenus);
  const orderPage = useSelector(selectOrderPage);
  const area = customerArea(pathname);
  const orderToken = area.token;
  const pageSlug =
    orderToken === undefined
      ? (area.slug ?? '')
      : (orderSlug(orderPage, orderToken) ?? area.slug ?? '');
  const missing = useSelector((state: CustomerRootState) => selectKitchenMissing(state, pageSlug));

  if (area.kind === 'settings' && area.sub.length === 0) {
    // `/<slug>/settings` is that kitchen's; `/settings` shows whichever menu is loaded.
    if (area.slug !== null) {
      return menu.status === 'ready' && menuSlug === area.slug
        ? { kind: 'ready', slug: area.slug, kitchen: menu.data.kitchen }
        : { kind: 'pending', slug: area.slug };
    }
    return menu.status === 'ready' && menuSlug !== null
      ? { kind: 'ready', slug: menuSlug, kitchen: menu.data.kitchen }
      : { kind: 'pending', slug: lastKitchen() };
  }
  if (area.kind === 'orders' && area.sub.length === 0) {
    const slug = area.slug ?? ownKitchen() ?? lastKitchen();
    const kitchen = slug === null ? undefined : menus[slug]?.kitchen;
    return slug !== null && kitchen ? { kind: 'ready', slug, kitchen } : { kind: 'pending', slug };
  }
  if (area.kind === 'settings' || area.kind === 'orders') return NONE; // their sub-pages (Start fresh)
  // Every other page of a kitchen: the path's slug, or the order's seller (plan 094).
  if (!isValidSlug(pageSlug) || missing) return NONE;
  if (orderToken !== undefined) {
    const kitchen =
      menus[pageSlug]?.kitchen ??
      (menuSlug === pageSlug && menu.status === 'ready' ? menu.data.kitchen : undefined);
    return kitchen
      ? { kind: 'ready', slug: pageSlug, kitchen }
      : { kind: 'pending', slug: pageSlug };
  }
  if (menuSlug !== pageSlug) return { kind: 'pending', slug: pageSlug };
  if (menu.status === 'error' && menu.code === 'week_not_published') return NONE;
  if (menu.status !== 'ready') return { kind: 'pending', slug: pageSlug };
  return { kind: 'ready', slug: pageSlug, kitchen: menu.data.kitchen };
}

export function useShellBanner(pathname: string): ShellBannerState {
  const wanted = useWanted(pathname);
  const [kept, setKept] = useState<Kept | null>(null);
  if (wanted.kind === 'ready' && kept?.kitchen !== wanted.kitchen) {
    setKept({ slug: wanted.slug, kitchen: wanted.kitchen });
  }
  if (wanted.kind === 'ready') return { kind: 'kitchen', kitchen: wanted.kitchen };
  if (wanted.kind === 'none') return { kind: 'none' };
  // Still loading: the banner already shown for this kitchen stays; else a grey block on the menu.
  if (kept && kept.slug === wanted.slug) return { kind: 'kitchen', kitchen: kept.kitchen };
  const { kind, sub } = customerArea(pathname);
  const onMenu = !((kind === 'settings' || kind === 'orders') && sub.length === 0);
  return onMenu ? { kind: 'skeleton' } : { kind: 'none' };
}

export function ShellBanner({
  state,
  onTallInView,
}: Readonly<{ state: ShellBannerState; onTallInView?: (inView: boolean) => void }>) {
  const lang = useLang();
  if (state.kind === 'skeleton') return <BannerSkeleton />;
  if (state.kind === 'none') return null;
  return (
    <KitchenBanner
      kitchen={state.kitchen}
      lang={lang}
      placeholder={state.kitchen.name}
      onTallInView={onTallInView}
    />
  );
}
