import { useEffect, useMemo, useState, type UIEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import type { Kitchen } from '../../shared/domain';
import { bannerAlt, phoneBannerSrc } from '../../shared/kitchenImages';
import { fetchMenu } from '../api/client';
import { currentSellerSlug } from '../api/device/sellerContext';
import { cssUrl } from '../components/cssUrl';
import { useManifestLinks } from '../components/install';
import { sellerKitchenOfSearch, sellerManifestTarget } from '../components/install/manifestLinks';
import { useBannerCollapsed } from '../components/useBannerCollapsed';
import { useMediaQuery } from '../components/useMediaQuery';
import { WhatsNewPill } from '../components/whats-new/WhatsNewPill';
import { ABOUT_NS, currentRelease } from '../features/seller-about';
import { SellerMoveNotice } from './SellerMoveNotice';
import { launchMemory } from './launchKitchen';
import { IncomeAccessProvider } from '../components/chef-income';
import { ReadOnlyOrdersProvider, useNewOrderTitle } from '../features/seller-orders';
import { ImageSlot } from '../ui';
import {
  BANNER_RATIO,
  BANNER_SCROLL_PX,
  BANNER_STRIP_HEIGHT,
  DESKTOP_QUERY,
  RAIL_TOP_COLLAPSED_PX,
  RAIL_TOP_PX,
} from './layout';
import { KitchenNotices } from './kitchenNotice';
import { PhoneBar } from './PhoneBar';
import { useRailCollapsed } from './railPreference';
import { SellerRail } from './SellerRail';
import {
  activeNav,
  activePhoneNav,
  fixesPage,
  hidesPhoneBar,
  isPhoneOrdersList,
  isTabletOnly,
  isTaskScreen,
  navIdsFor,
} from './sellerNav';
import { TabletOnlyPage } from './TabletOnlyPage';
import { useNotPublished } from './useNotPublished';
import { useSession } from './session';
import { SCREEN_HEIGHT } from '../theme/screen';

// One shell for both layouts: the page (Outlet) keeps the same place in the tree, so crossing the
// 600 px breakpoint (a rotated tablet, a resized window) does not remount it and lose a
// half-filled form.
// $fixed (plan 008, Orders home): the shell is exactly one screen tall and does not scroll; the
// screen inside scrolls its own list. min-height: 0 down the chain lets that inner area shrink.
const Shell = styled.div<{ $tablet: boolean; $fixed: boolean }>`
  display: ${({ $tablet }) => ($tablet ? 'grid' : 'flex')};
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: ${({ $fixed }) => ($fixed ? 'minmax(0, 1fr)' : 'auto')};
  flex-direction: column;
  min-height: ${SCREEN_HEIGHT};
  ${({ $fixed }) => ($fixed ? `height: ${SCREEN_HEIGHT}; overflow: hidden;` : '')}
  font-size: ${({ $tablet }) => ($tablet ? '0.875rem' : '0.9375rem')};
`;
const Main = styled.div<{ $tablet: boolean; $fixed: boolean }>`
  flex: 1;
  min-width: 0;
  background: ${({ $tablet, theme }) => ($tablet ? theme.c.panel : theme.c.bg)};
  ${({ $fixed }) => ($fixed ? 'display: flex; flex-direction: column; min-height: 0;' : '')}
`;
// The banners and the signed-in line keep their height while the sheet below shrinks.
const Top = styled.div`
  flex: none;
`;
const Who = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  text-align: right;
`;
// The strip fills the full content width with the wide banner (plan 040): no side bands. The
// seller's colour and background picture stay only as the loading fallback behind the image.
const BannerStrip = styled.div<{ $background?: string; $image?: string; $task?: boolean }>`
  background-color: ${({ theme, $background }) => $background ?? theme.c.surf2};
  ${({ $image }) =>
    $image
      ? `background-image: ${cssUrl($image)}; background-size: cover; background-position: center;`
      : ''}
  ${({ $task }) => ($task ? `height: ${BANNER_STRIP_HEIGHT}; overflow: hidden;` : '')}
`;
// The banner at full size: as tall as the left menu's top, or shorter when the content is too
// narrow for the middle 1896 x 328 to show uncut (height = min(menu top, width x 328 / 1896)).
const BannerFull = styled.div`
  width: 100%;
  aspect-ratio: ${BANNER_RATIO};
  max-height: ${RAIL_TOP_PX}px;
`;
// Plan 014 / 040: the banner area slides up to a strip while the image keeps its size, so only its
// top shows (the sheet slides over it). Expanded, the max-height is the tallest the banner gets;
// reduced motion is switched off globally.
const BannerClip = styled.div<{
  $collapsed: boolean;
  $open: string;
  $closed: string;
  $hidden?: boolean;
}>`
  display: ${({ $hidden }) => ($hidden ? 'none' : 'flex')};
  align-items: flex-start;
  max-height: ${({ $collapsed, $open, $closed }) => ($collapsed ? $closed : $open)};
  overflow: hidden;
  transition: max-height ${({ theme }) => theme.motion.fast};

  > * {
    flex: none;
    width: 100%;
  }
`;
// The content sheet: 16 px top corners that overlap the banner above.
const Sheet = styled.div<{ $tablet: boolean; $fixed: boolean }>`
  position: relative;
  min-height: ${({ $fixed }) => ($fixed ? '0' : '60dvh')};
  ${({ $fixed }) => ($fixed ? 'flex: 1; display: flex; flex-direction: column;' : '')}
  margin-top: ${({ $tablet, theme }) => ($tablet ? `-${theme.size.radiusSheet}px` : '0')};
  border-radius: ${({ $tablet, theme }) =>
    $tablet ? `${theme.size.radiusSheet}px ${theme.size.radiusSheet}px 0 0` : '0'};
  background: ${({ theme }) => theme.c.bg};
`;

// Tablet Home scrolls inside the sheet (like Orders), so the sheet can slide over the banner.
const Scroller = styled.div<{ $on: boolean }>`
  ${({ $on }) => ($on ? 'flex: 1; min-height: 0; overflow-y: auto;' : 'display: contents;')}
`;

/** The kitchen (name and images) from the public menu; null until it arrives. */
function useKitchen(): Kitchen | null {
  const [kitchen, setKitchen] = useState<Kitchen | null>(null);
  useEffect(() => {
    let live = true;
    void fetchMenu(currentSellerSlug()).then((result) => {
      if (live && result.ok) setKitchen(result.data.kitchen);
    });
    return () => {
      live = false;
    };
  }, []);
  return kitchen;
}

/** The signed-in person as the bar shows them: the seller's kitchen, or "Chef Wati". */
function useWho(): string | null {
  const { t } = useTranslation();
  const { me } = useSession();
  if (me === null) return null;
  if (me.role === 'chef') return t('sellerNav.signedInChef', { name: me.chefName ?? '' });
  if (me.role === 'helper') return t('sellerNav.signedInHelper', { name: me.displayName ?? '' });
  return me.sellerName ?? null;
}

// The guard in front of this layout has already checked the sign-in (see guards.tsx).
export function SellerLayout() {
  const { t, i18n } = useTranslation();
  const tablet = useMediaQuery(DESKTOP_QUERY);
  const { pathname } = useLocation();
  const { me } = useSession();
  const who = useWho();
  // ShaggyBobo's seller app manifest on every seller page (plan 048), unless the page was opened with
  // `?k=<slug>` (plan 101): then the Worker already linked that kitchen's seller app, and this keeps it
  // through the in-app navigation that drops the query. With no `?k` the kitchen this window was launched
  // for (session memory) is used; with neither, the generic app (plan 101 risk 4).
  const [launchSlug] = useState(
    () => sellerKitchenOfSearch(window.location.search) ?? launchMemory() ?? undefined,
  );
  useManifestLinks(sellerManifestTarget(launchSlug), true);
  const role =
    me?.role === 'chef' || me?.role === 'helper' || me?.role === 'seller' ? me.role : undefined;
  const navIds = useMemo(() => navIdsFor(role), [role]);
  const kitchen = useKitchen();
  const notPublished = useNotPublished(role === 'seller', pathname);
  const [collapsed, toggleCollapsed] = useRailCollapsed();
  const lang = i18n.language.startsWith('id') ? 'id' : 'en';
  const kitchenName = kitchen?.name ?? t('sellerNav.kitchen');
  useNewOrderTitle(t('sellerNav.navOrders'), kitchenName);
  const bannerText = kitchen
    ? bannerAlt(kitchen, lang)
    : `${kitchenName} — ${t('sellerNav.bannerImage')}`;
  const placeholder = t('sellerNav.imageSoon');
  const background = kitchen?.images?.bannerBackground;
  const backgroundImage = kitchen?.images?.bannerBackgroundImage;
  // The Switch person block already names the signed-in person: in the open panel, and at the top
  // of the More tab on a phone. Everywhere else the bar is the only place the name appears.
  const nameShownElsewhere = tablet ? !collapsed : pathname === '/seller/more';
  const tabletOnlyHere =
    !tablet && isTabletOnly(pathname, me?.role === 'chef' ? 'chef' : undefined);
  // Phone: the 3:1 banner belongs to the Orders list only; other phone screens have none.
  const phoneBanner = !tablet && isPhoneOrdersList(pathname);
  // Task screens: the banner shrinks to a thin strip (same element, image hidden, never remounted).
  const task = isTaskScreen(pathname);
  const homeTablet = tablet && pathname === '/seller';
  const fixed = fixesPage(pathname, tablet) || homeTablet;
  // The banner slides under the sheet by the button (Orders, remembered) or by scrolling the sheet
  // content on tablet Home and Orders (plan 040); back at the top it returns.
  const slides = tablet && (homeTablet || pathname === '/seller/orders');
  // Remembered with the page it happened on, so a new page starts at the top.
  const [scrolledOn, setScrolledOn] = useState<string | null>(null);
  const scrolled = scrolledOn === pathname;
  const onSheetScroll = (event: UIEvent<HTMLElement>) => {
    if (slides && event.target instanceof HTMLElement) {
      // The banner's collapse makes the scroll area taller. Collapse only when the content overflows
      // by more than that, or the area shrinks back to no overflow and the last rows can't be reached.
      const { scrollTop, scrollHeight, clientHeight } = event.target;
      const room = scrollHeight - clientHeight;
      const fits = scrolled || room > RAIL_TOP_PX - RAIL_TOP_COLLAPSED_PX + BANNER_SCROLL_PX;
      setScrolledOn(scrollTop > BANNER_SCROLL_PX && fits ? pathname : null);
    }
  };
  const stored = useBannerCollapsed();
  // The left menu and the banner are unlinked (owner, 2026-10-12): only the stored toggle or a scroll collapses it.
  const bannerCollapsed = (stored && fixesPage(pathname, tablet)) || (slides && scrolled);

  const release = currentRelease();
  const { t: tAbout } = useTranslation(ABOUT_NS);
  const navigate = useNavigate();

  return (
    <Shell $tablet={tablet} $fixed={fixed}>
      <SellerMoveNotice />
      {release ? (
        <WhatsNewPill
          version={release.version}
          note={release.lines[lang][0] ?? ''}
          title={tAbout('whatsNewIn', { version: release.version })}
          see={tAbout('see')}
          hide={tAbout('hideWhatsNew')}
          onSee={() => void navigate('/seller/about', { state: { showReleases: true } })}
        />
      ) : null}
      {tablet ? (
        <SellerRail
          ids={navIds}
          activeId={activeNav(pathname)}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          kitchen={kitchen}
          menuNotPublished={notPublished}
          showPicker={me === null}
        />
      ) : null}
      <Main $tablet={tablet} $fixed={fixed}>
        <Top>
          <KitchenNotices />
          {who && !nameShownElsewhere ? (
            <Who>{t('sellerNav.signedInAs', { name: who })}</Who>
          ) : null}
          {tablet ? (
            <BannerStrip $background={background} $image={backgroundImage} $task={task}>
              <BannerClip
                $hidden={task}
                $collapsed={bannerCollapsed}
                $open={`${RAIL_TOP_PX}px`}
                $closed={`${RAIL_TOP_COLLAPSED_PX}px`}
              >
                <BannerFull>
                  <ImageSlot
                    fill
                    fit="cover"
                    aspectRatio="3840 / 328"
                    background={background}
                    src={kitchen?.images?.desktopBanner}
                    alt={bannerText}
                    placeholder={placeholder}
                    eager
                  />
                </BannerFull>
              </BannerClip>
            </BannerStrip>
          ) : (
            <BannerClip
              $hidden={!phoneBanner}
              $collapsed={bannerCollapsed}
              $open="24rem"
              $closed="50px"
            >
              <ImageSlot
                aspectRatio="3 / 1"
                background={background}
                src={phoneBannerSrc(kitchen?.images)}
                alt={bannerText}
                placeholder={placeholder}
                eager
              />
            </BannerClip>
          )}
        </Top>
        <Sheet $tablet={tablet} $fixed={fixed} onScrollCapture={onSheetScroll}>
          <IncomeAccessProvider role={me?.role} chefId={me?.chefId}>
            <ReadOnlyOrdersProvider value={me?.role === 'helper'}>
              <Scroller $on={homeTablet}>
                {tabletOnlyHere ? <TabletOnlyPage /> : <Outlet />}
              </Scroller>
            </ReadOnlyOrdersProvider>
          </IncomeAccessProvider>
        </Sheet>
      </Main>
      {tablet || hidesPhoneBar(pathname) ? null : <PhoneBar activeId={activePhoneNav(pathname)} />}
    </Shell>
  );
}
