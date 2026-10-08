import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import type { Kitchen } from '../../shared/domain';
import { bannerAlt, phoneBannerSrc } from '../../shared/kitchenImages';
import { fetchMenu } from '../api/client';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useMediaQuery } from '../components/useMediaQuery';
import { Icon, ImageSlot, TabBar, Tooltip, type IconName, type TabBarItem } from '../ui';
import { BANNER_MAX_WIDTH, DESKTOP_QUERY, RAIL_WIDTH, RAIL_WIDTH_COLLAPSED } from './layout';
import { useRailCollapsed } from './railPreference';

// Seller navigation: a bottom tab bar on a phone, a left rail on a desktop. Hand-over and Menu
// arrive with later batches and stay inert until then.
const NAV_IDS = ['orders', 'cook', 'handover', 'menu', 'more'] as const;
type NavId = (typeof NAV_IDS)[number];

const HREF: Readonly<Record<NavId, string>> = {
  orders: '/seller',
  cook: '/seller/cook',
  handover: '/seller',
  menu: '/seller',
  more: '/seller/settings',
};
const ICON: Readonly<Record<NavId, IconName>> = {
  orders: 'list',
  cook: 'pot',
  handover: 'box',
  menu: 'menu',
  more: 'dots',
};
const INERT: ReadonlySet<NavId> = new Set(['handover', 'menu']);

function activeNav(pathname: string): NavId {
  if (pathname.startsWith('/seller/cook')) return 'cook';
  if (pathname.startsWith('/seller/settings') || pathname.startsWith('/seller/share'))
    return 'more';
  return 'orders';
}

const PhoneShell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
`;
const Grow = styled.div`
  flex: 1;
`;
const Bottom = styled.footer`
  position: sticky;
  bottom: 0;
  background: ${({ theme }) => theme.colour.bg};
`;
const DesktopShell = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  min-height: 100dvh;
  font-size: ${({ theme }) => theme.type.size.base};
`;
const Rail = styled.nav<{ $collapsed: boolean }>`
  position: sticky;
  box-sizing: border-box;
  width: ${({ $collapsed }) => ($collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH)};
  overflow-x: clip;
  transition: width 150ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  top: 0;
  align-self: start;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.lg}
    ${({ $collapsed, theme }) => ($collapsed ? theme.spacing.xs : theme.spacing.md)};
  border-right: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  background: ${({ theme }) => theme.colour.surface};
`;
const Kitchen = styled.p`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.type.size.lg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const RailList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: 0;
  padding: 0;
  list-style: none;
`;
const RailItem = styled(Link)<{ $active: boolean; $collapsed: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: ${({ $collapsed }) => ($collapsed ? 'center' : 'flex-start')};
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 3rem;
  padding: 0 ${({ theme, $collapsed }) => ($collapsed ? '0' : theme.spacing.md)};
  white-space: nowrap;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $active }) => ($active ? theme.colour.surfaceAlt : 'transparent')};
  color: ${({ theme }) => theme.colour.text};
  font-weight: ${({ theme, $active }) =>
    $active ? theme.type.weight.strong : theme.type.weight.regular};
  text-decoration: none;

  /* The current page is marked by weight and a bar, not by colour alone. */
  &::before {
    content: '';
    display: ${({ $active }) => ($active ? 'block' : 'none')};
    position: absolute;
    left: 0;
    top: 0.625rem;
    bottom: 0.625rem;
    width: 0.25rem;
    border-radius: 0.125rem;
    background: ${({ theme }) => theme.colour.accent};
  }
`;
const RailInert = styled.span<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $collapsed }) => ($collapsed ? 'center' : 'flex-start')};
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 3rem;
  padding: 0 ${({ theme, $collapsed }) => ($collapsed ? '0' : theme.spacing.md)};
  white-space: nowrap;
  color: ${({ theme }) => theme.colour.textMuted};
  opacity: 0.7;
`;
const RailFoot = styled.div<{ $collapsed: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $collapsed }) => ($collapsed ? 'center' : 'stretch')};
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: auto;
  padding: 0 ${({ theme, $collapsed }) => ($collapsed ? '0' : theme.spacing.sm)};
`;
// Kept in the page for screen readers while the rail shows icons only.
const Hidden = styled.span`
  position: absolute;
  width: 0.0625rem;
  height: 0.0625rem;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;
const RailButton = styled.button<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $collapsed }) => ($collapsed ? 'center' : 'flex-start')};
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: 3rem;
  padding: 0 ${({ theme, $collapsed }) => ($collapsed ? '0' : theme.spacing.md)};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colour.surfaceAlt};
  }
`;
const Chevron = styled.span`
  width: 1.25rem;
  flex: none;
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: 1;
  text-align: center;
`;
const Main = styled.div`
  min-width: 0;
`;
// The banner strip fills the full width in the seller's colour; the image sits centred in it at
// most 1600 px wide, so on a wide screen the sides are colour, never a cropped picture (D-038).
const BannerStrip = styled.div<{ $background?: string }>`
  background: ${({ theme, $background }) => $background ?? theme.colour.surfaceAlt};
`;
const BannerArea = styled.div`
  max-width: ${BANNER_MAX_WIDTH};
  margin: 0 auto;
`;
// Full-bleed at the top of the expanded rail, cancelling the rail's padding.
const RailImageBox = styled.div`
  margin: calc(-1 * ${({ theme }) => theme.spacing.lg})
    calc(-1 * ${({ theme }) => theme.spacing.md}) 0;
`;
const RailIconBox = styled.div`
  display: flex;
  justify-content: center;
`;
const Initial = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  border-radius: 50%;
  background: ${({ theme }) => theme.colour.accent};
  color: ${({ theme }) => theme.colour.onAccent};
  font-size: ${({ theme }) => theme.type.size.lg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: 1;
`;

/** The first letter of the kitchen name, for the collapsed rail when there is no icon. */
function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

/** EN / ID as one small button, for the collapsed rail. */
function CompactLanguage() {
  const { t, i18n } = useTranslation();
  const isId = i18n.language.startsWith('id');
  const next = isId ? 'en' : 'id';
  const change = useCallback(() => void i18n.changeLanguage(next), [i18n, next]);
  const name = t(`language.name.${next}`);
  return (
    <RailButton
      type="button"
      $collapsed
      onClick={change}
      aria-label={`${t('language.label')}: ${isId ? 'ID' : 'EN'}. ${t('language.switchTo', { name })}`}
    >
      {isId ? 'ID' : 'EN'}
    </RailButton>
  );
}

/** The kitchen (name and images) from the public menu; null until it arrives. */
function useKitchen(): Kitchen | null {
  const [kitchen, setKitchen] = useState<Kitchen | null>(null);
  useEffect(() => {
    let live = true;
    void fetchMenu().then((result) => {
      if (live && result.ok) setKitchen(result.data.kitchen);
    });
    return () => {
      live = false;
    };
  }, []);
  return kitchen;
}

// Seller routes have no sign-in until phase 4 (D-011); anyone with the link can open them.
export function SellerLayout() {
  const { t, i18n } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = activeNav(pathname);
  const kitchen = useKitchen();
  const lang = i18n.language.startsWith('id') ? 'id' : 'en';
  const kitchenName = kitchen?.name ?? t('sellerNav.kitchen');
  const bannerText = kitchen
    ? bannerAlt(kitchen, lang)
    : `${kitchenName} — ${t('sellerNav.bannerImage')}`;
  const placeholder = t('sellerNav.imageSoon');
  const background = kitchen?.images?.bannerBackground;
  const [collapsed, toggleCollapsed] = useRailCollapsed();

  const label = (id: NavId) => t(`sellerNav.${id}`);
  const tabs = useMemo<Array<TabBarItem>>(
    () =>
      NAV_IDS.map((id) =>
        INERT.has(id)
          ? {
              id,
              label: t(`sellerNav.${id}`),
              href: HREF[id],
              disabled: true,
              hint: t('sellerNav.comingSoon'),
            }
          : { id, label: t(`sellerNav.${id}`), href: HREF[id] },
      ),
    [t],
  );

  // The tab bar renders plain links; keep them inside the single-page app.
  const onTabClick = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    const href = link?.getAttribute('href');
    if (!href?.startsWith('/')) return;
    event.preventDefault();
    void navigate(href);
  };

  const collapseLabel = t(collapsed ? 'sellerNav.expand' : 'sellerNav.collapse');
  if (desktop) {
    return (
      <DesktopShell>
        <Rail aria-label={t('sellerNav.label')} $collapsed={collapsed}>
          {collapsed ? (
            <RailIconBox>
              {kitchen?.images?.railIcon ? (
                <ImageSlot
                  aspectRatio="1 / 1"
                  width="2.5rem"
                  round
                  src={kitchen.images.railIcon}
                  alt={kitchenName}
                  placeholder=""
                />
              ) : (
                <Initial role="img" aria-label={kitchenName}>
                  <span aria-hidden="true">{initialOf(kitchenName)}</span>
                </Initial>
              )}
            </RailIconBox>
          ) : (
            <RailImageBox>
              <ImageSlot
                aspectRatio="2 / 1"
                src={kitchen?.images?.railImage}
                alt={`${kitchenName} — ${t('sellerNav.railImage')}`}
                placeholder={t('sellerNav.railImageSoon')}
              />
            </RailImageBox>
          )}
          {collapsed ? null : <Kitchen>{kitchenName}</Kitchen>}
          <RailList>
            {NAV_IDS.map((id) => (
              <li key={id}>
                <Tooltip text={collapsed ? label(id) : undefined}>
                  {INERT.has(id) ? (
                    <RailInert
                      role="link"
                      tabIndex={collapsed ? 0 : undefined}
                      aria-disabled="true"
                      aria-label={`${label(id)}, ${t('sellerNav.comingSoon')}`}
                      $collapsed={collapsed}
                    >
                      <Icon name={ICON[id]} />
                      {collapsed ? null : label(id)}
                    </RailInert>
                  ) : (
                    <RailItem
                      to={HREF[id]}
                      $active={id === active}
                      $collapsed={collapsed}
                      aria-current={id === active ? 'page' : undefined}
                    >
                      <Icon name={ICON[id]} />
                      {collapsed ? <Hidden>{label(id)}</Hidden> : label(id)}
                    </RailItem>
                  )}
                </Tooltip>
              </li>
            ))}
          </RailList>
          <RailFoot $collapsed={collapsed}>
            {collapsed ? <CompactLanguage /> : <LanguageSwitch />}
            <Tooltip text={collapsed ? collapseLabel : undefined}>
              <RailButton
                type="button"
                $collapsed={collapsed}
                aria-expanded={!collapsed}
                aria-label={collapseLabel}
                onClick={toggleCollapsed}
              >
                <Chevron aria-hidden="true">{collapsed ? '»' : '«'}</Chevron>
                {collapsed ? null : collapseLabel}
              </RailButton>
            </Tooltip>
          </RailFoot>
        </Rail>
        <Main>
          <BannerStrip $background={background}>
            <BannerArea>
              <ImageSlot
                aspectRatio="5 / 1"
                background={background}
                src={kitchen?.images?.desktopBanner}
                alt={bannerText}
                placeholder={placeholder}
              />
            </BannerArea>
          </BannerStrip>
          <Outlet />
        </Main>
      </DesktopShell>
    );
  }

  return (
    <PhoneShell>
      <Grow>
        <ImageSlot
          aspectRatio="2 / 1"
          background={background}
          src={phoneBannerSrc(kitchen?.images)}
          alt={bannerText}
          placeholder={placeholder}
        />
        <Outlet />
      </Grow>
      <Bottom onClick={onTabClick}>
        <TabBar items={tabs} activeId={active} label={t('sellerNav.label')} />
      </Bottom>
    </PhoneShell>
  );
}
