import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { styled } from 'styled-components';
import type { Kitchen } from '../../shared/domain';
import { bannerAlt, phoneBannerSrc } from '../../shared/kitchenImages';
import { fetchMenu } from '../api/client';
import { currentSellerSlug } from '../api/device/sellerContext';
import { cssUrl } from '../components/cssUrl';
import { sellerManifestTarget, useManifestLinks } from '../components/install';
import { useBannerCollapsed } from '../components/useBannerCollapsed';
import { useMediaQuery } from '../components/useMediaQuery';
import { ImageSlot } from '../ui';
import { BANNER_MAX_WIDTH, BANNER_STRIP_HEIGHT, DESKTOP_QUERY } from './layout';
import { PhoneBar } from './PhoneBar';
import { useRailCollapsed } from './railPreference';
import { SellerRail } from './SellerRail';
import {
  activeNav,
  activePhoneNav,
  fixesPage,
  hidesPhoneBar,
  isTabletOnly,
  isTaskScreen,
  navIdsFor,
} from './sellerNav';
import { TabletOnlyPage } from './TabletOnlyPage';
import { useNotPublished } from './useNotPublished';
import { useSession } from './session';

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
  min-height: 100dvh;
  ${({ $fixed }) => ($fixed ? 'height: 100dvh; overflow: hidden;' : '')}
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
// The strip fills the full width with the seller's background picture (D-040), on their colour
// while it loads or if there is none; the banner sits centred in it at most 1600 px wide, so on a
// wide screen the sides are background, never a cropped banner (D-038).
const BannerStrip = styled.div<{ $background?: string; $image?: string }>`
  background-color: ${({ theme, $background }) => $background ?? theme.c.surf2};
  ${({ $image }) =>
    $image
      ? `background-image: ${cssUrl($image)}; background-size: cover; background-position: center;`
      : ''}
`;
const BannerArea = styled.div`
  max-width: ${BANNER_MAX_WIDTH};
  margin: 0 auto;
`;
// Plan 014: the Orders home banner slides up to a 50 px strip (the picture cropped around its
// middle) on the toggle in the Orders header. The max-height only has to exceed the tallest banner
// (1600 px wide at 5:1 = 20 rem); reduced motion is switched off globally.
const BannerClip = styled.div<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  max-height: ${({ $collapsed }) => ($collapsed ? '50px' : '24rem')};
  overflow: hidden;
  transition: max-height ${({ theme }) => theme.motion.fast};

  > * {
    flex: none;
    width: 100%;
  }
`;
// Task screens: the banner shrinks to a thin strip of the background; the sheet rises over it.
const TaskStrip = styled(BannerStrip)`
  height: ${BANNER_STRIP_HEIGHT};
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
  return me.sellerName ?? null;
}

// The guard in front of this layout has already checked the sign-in (see guards.tsx).
export function SellerLayout() {
  const { t, i18n } = useTranslation();
  const tablet = useMediaQuery(DESKTOP_QUERY);
  const { pathname } = useLocation();
  const { me } = useSession();
  const who = useWho();
  useManifestLinks(me?.stage === 'full' ? sellerManifestTarget(me.slug) : null);
  const role = me?.role === 'chef' ? 'chef' : me?.role === 'seller' ? 'seller' : undefined;
  const navIds = useMemo(() => navIdsFor(role), [role]);
  const kitchen = useKitchen();
  const notPublished = useNotPublished(role === 'seller', pathname);
  const [collapsed, toggleCollapsed] = useRailCollapsed();
  const lang = i18n.language.startsWith('id') ? 'id' : 'en';
  const kitchenName = kitchen?.name ?? t('sellerNav.kitchen');
  const bannerText = kitchen
    ? bannerAlt(kitchen, lang)
    : `${kitchenName} — ${t('sellerNav.bannerImage')}`;
  const placeholder = t('sellerNav.imageSoon');
  const background = kitchen?.images?.bannerBackground;
  const backgroundImage = kitchen?.images?.bannerBackgroundImage;
  // The Switch person block already names the signed-in person: in the open panel, and at the top
  // of the More tab on a phone. Everywhere else the bar is the only place the name appears.
  const nameShownElsewhere = tablet ? !collapsed : pathname === '/seller/more';
  const tabletOnlyHere = !tablet && isTabletOnly(pathname);
  // Phone: the 3:1 banner belongs to the Orders list only; other phone screens have none.
  const phoneBanner = !tablet && pathname === '/seller';
  const fixed = fixesPage(pathname, tablet);
  const bannerCollapsed = useBannerCollapsed() && fixed;

  return (
    <Shell $tablet={tablet} $fixed={fixed}>
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
          {who && !nameShownElsewhere ? (
            <Who>{t('sellerNav.signedInAs', { name: who })}</Who>
          ) : null}
          {tablet && isTaskScreen(pathname) ? (
            <TaskStrip $background={background} $image={backgroundImage} aria-hidden="true" />
          ) : null}
          {tablet && !isTaskScreen(pathname) ? (
            <BannerStrip $background={background} $image={backgroundImage}>
              <BannerClip $collapsed={bannerCollapsed}>
                <BannerArea>
                  <ImageSlot
                    aspectRatio="5 / 1"
                    background={background}
                    src={kitchen?.images?.desktopBanner}
                    alt={bannerText}
                    placeholder={placeholder}
                  />
                </BannerArea>
              </BannerClip>
            </BannerStrip>
          ) : null}
          {phoneBanner ? (
            <BannerClip $collapsed={bannerCollapsed}>
              <ImageSlot
                aspectRatio="3 / 1"
                background={background}
                src={phoneBannerSrc(kitchen?.images)}
                alt={bannerText}
                placeholder={placeholder}
              />
            </BannerClip>
          ) : null}
        </Top>
        <Sheet $tablet={tablet} $fixed={fixed}>
          {tabletOnlyHere ? <TabletOnlyPage /> : <Outlet />}
        </Sheet>
      </Main>
      {tablet || hidesPhoneBar(pathname) ? null : <PhoneBar activeId={activePhoneNav(pathname)} />}
    </Shell>
  );
}
