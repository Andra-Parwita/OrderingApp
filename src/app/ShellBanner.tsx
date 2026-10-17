import { useState } from 'react';
import { useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Kitchen } from '../../shared/domain';
import { isValidSlug } from '../../shared/seller';
import { lastKitchen } from '../api/device/lastKitchen';
import { KitchenBanner } from '../components/KitchenBanner';
import { ownKitchen } from '../components/install';
import {
  selectKitchenMissing,
  selectMenu,
  selectMenuSlug,
  useLang,
  type CustomerRootState,
} from '../features/customer-menu';
import { selectMenus } from '../features/customer-orders';

// The kitchen banner of Menu home, My orders and Settings (plan 093). It lives in the shell,
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
`;

/** Which banner the page at this address wants, from what the store already holds. */
function useWanted(pathname: string): Wanted {
  const menu = useSelector(selectMenu);
  const menuSlug = useSelector(selectMenuSlug);
  const menus = useSelector(selectMenus);
  const homeSlug = /^\/([^/]+)\/?$/.exec(pathname)?.[1] ?? '';
  const missing = useSelector((state: CustomerRootState) => selectKitchenMissing(state, homeSlug));

  if (pathname === '/settings') {
    return menu.status === 'ready' && menuSlug !== null
      ? { kind: 'ready', slug: menuSlug, kitchen: menu.data.kitchen }
      : { kind: 'pending', slug: lastKitchen() };
  }
  if (pathname === '/my-orders') {
    const slug = ownKitchen() ?? lastKitchen();
    const kitchen = slug === null ? undefined : menus[slug]?.kitchen;
    return slug !== null && kitchen ? { kind: 'ready', slug, kitchen } : { kind: 'pending', slug };
  }
  if (!isValidSlug(homeSlug) || missing) return NONE;
  if (menuSlug !== homeSlug) return { kind: 'pending', slug: homeSlug };
  if (menu.status === 'error' && menu.code === 'week_not_published') return NONE;
  if (menu.status !== 'ready') return { kind: 'pending', slug: homeSlug };
  const { ordering, pictureUrl, kitchen } = menu.data;
  // A closed menu with a picture shows the picture in place of the banner.
  if (ordering.reason !== 'not_published' && !ordering.open && pictureUrl) return NONE;
  return { kind: 'ready', slug: homeSlug, kitchen };
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
  const onMenu = pathname !== '/settings' && pathname !== '/my-orders';
  return onMenu ? { kind: 'skeleton' } : { kind: 'none' };
}

export function ShellBanner({ state }: Readonly<{ state: ShellBannerState }>) {
  const lang = useLang();
  if (state.kind === 'skeleton') return <BannerSkeleton />;
  if (state.kind === 'none') return null;
  return <KitchenBanner kitchen={state.kitchen} lang={lang} placeholder={state.kitchen.name} />;
}
