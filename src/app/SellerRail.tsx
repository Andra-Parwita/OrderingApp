import { useCallback, useContext, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactReduxContext } from 'react-redux';
import { Link } from 'react-router';
import { styled } from 'styled-components';
import type { Kitchen } from '../../shared/domain';
import { LanguageSwitch } from '../components/LanguageSwitch';
import {
  selectOrdersCount,
  useUnseenNewOrders,
  type SellerOrdersRootState,
} from '../features/seller-orders';
import { ABOUT_NS } from '../features/seller-about';
import { HELP_NS } from '../features/seller-help';
import { SellerPicker } from '../components/SellerPicker';
import { KitchenSwitcher } from './KitchenSwitcher';
import { Icon, ImageSlot, Tooltip } from '../ui';
import { RAIL_LOGO_PX, RAIL_TOP_COLLAPSED_PX, RAIL_TOP_PX } from './layout';
import { HOME_ICON_PATH, HREF, ICON, type NavId } from './sellerNav';
import { RailSwitchPerson } from './SwitchPerson';
import { SCREEN_HEIGHT, TOP_BARS } from '../theme/screen';

const LABEL_KEY: Readonly<Record<NavId, string>> = {
  home: 'sellerNav.navHome',
  orders: 'sellerNav.navOrders',
  kitchen: 'sellerNav.navKitchen',
  handover: 'sellerNav.navHandover',
  sell: 'sellerNav.navSell',
  menu: 'sellerNav.navMenu',
  settings: 'sellerNav.navSettings',
  help: 'nav',
  about: 'nav',
};

// Home's icon is not in the kit (src/ui); it is drawn like the others (outline, current colour).
const HomeSvg = styled.svg`
  width: 1.25rem;
  height: 1.25rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
`;
function NavIcon({ id }: Readonly<{ id: NavId }>) {
  if (id !== 'home') return <Icon name={ICON[id]} />;
  return (
    <HomeSvg viewBox="0 0 24 24" aria-hidden="true">
      <path d={HOME_ICON_PATH} />
    </HomeSvg>
  );
}

const Column = styled.div`
  border-right: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.panel};
`;
const Rail = styled.nav<{ $collapsed: boolean }>`
  position: sticky;
  top: ${TOP_BARS};
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  width: ${({ $collapsed, theme }) => ($collapsed ? theme.size.navCollapsed : theme.size.navOpen)}px;
  height: ${SCREEN_HEIGHT};
  padding: 0 ${({ $collapsed, theme }) => ($collapsed ? theme.spacing.sm : theme.spacing.md)}
    ${({ theme }) => theme.spacing.lg};
  overflow-x: clip;
  overflow-y: auto;
  transition: width 150ms ease;
`;
// The top block (plan 040): no card, no padding. The logo fills its block edge to edge, the kitchen
// name sits below it; together they are RAIL_TOP_PX tall, the same as the banner.
const TopBlock = styled.div<{ $collapsed: boolean }>`
  box-sizing: border-box;
  display: flex;
  flex: none;
  flex-direction: column;
  height: ${({ $collapsed }) => ($collapsed ? RAIL_TOP_COLLAPSED_PX : RAIL_TOP_PX)}px;
  margin: 0
    calc(-1 * ${({ $collapsed, theme }) => ($collapsed ? theme.spacing.sm : theme.spacing.md)});
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const LogoBox = styled.div<{ $collapsed: boolean }>`
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: ${({ $collapsed }) => ($collapsed ? RAIL_TOP_COLLAPSED_PX - 1 : RAIL_LOGO_PX)}px;
`;
const KitchenName = styled.p`
  display: flex;
  flex: 1;
  align-items: center;
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.md};
  overflow: hidden;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Item = styled(Link)<{ $active: boolean; $collapsed: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: ${({ $collapsed }) => ($collapsed ? 'center' : 'flex-start')};
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 3rem;
  padding: 0 ${({ $collapsed, theme }) => ($collapsed ? '0' : theme.spacing.md)};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ $active, theme }) => ($active ? theme.c.tint : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.c.atext : theme.c.text)};
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
  /* The current page is marked by weight, tint and a bar, never colour alone. */
  &::before {
    content: '';
    display: ${({ $active }) => ($active ? 'block' : 'none')};
    position: absolute;
    left: 0;
    top: 0.625rem;
    bottom: 0.625rem;
    width: 0.25rem;
    border-radius: 0.125rem;
    background: ${({ theme }) => theme.c.fill};
  }
`;
const Hidden = styled.span`
  position: absolute;
  width: 0.0625rem;
  height: 0.0625rem;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;
// "Not published": a status icon plus the word, in the warning colour.
const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-left: auto;
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.75rem;
  font-weight: 700;

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
`;
/** The live menu's order count beside Orders. */
const noSubscribe = () => () => undefined;

/** The live menu's order count; null before the first load or without a store (tests of the shell). */
function useOrdersCount(): number | null {
  const store = useContext(ReactReduxContext)?.store;
  const subscribe = useCallback(
    (onChange: () => void) => (store ? store.subscribe(onChange) : noSubscribe()),
    [store],
  );
  return useSyncExternalStore(subscribe, () =>
    store ? selectOrdersCount(store.getState() as SellerOrdersRootState) : null,
  );
}

const Count = styled.span`
  margin-left: auto;
  color: ${({ theme }) => theme.c.atext};
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;
const Dot = styled.span`
  position: absolute;
  top: 0.625rem;
  right: 1rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.warn};
`;
const Foot = styled.div<{ $collapsed: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $collapsed }) => ($collapsed ? 'center' : 'stretch')};
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: auto;
  padding: 0 ${({ $collapsed, theme }) => ($collapsed ? '0' : theme.spacing.sm)};
`;
const FootButton = styled.button<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $collapsed }) => ($collapsed ? 'center' : 'flex-start')};
  gap: ${({ theme }) => theme.spacing.md};
  width: ${({ $collapsed }) => ($collapsed ? '2.75rem' : '100%')};
  min-height: 2.75rem;
  padding: 0 ${({ $collapsed, theme }) => ($collapsed ? '0' : theme.spacing.sm)};
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
`;
const ExpandedLanguage = styled.div`
  align-self: flex-start;
`;
const Initial = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1;
`;

/** The first letter of the kitchen name, for the collapsed panel when there is no icon. */
function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

/** EN / ID as one small button, for the collapsed panel. */
function CompactLanguage() {
  const { t, i18n } = useTranslation();
  const isId = i18n.language.startsWith('id');
  const next = isId ? 'en' : 'id';
  const change = useCallback(() => void i18n.changeLanguage(next), [i18n, next]);
  return (
    <FootButton
      type="button"
      $collapsed
      onClick={change}
      aria-label={`${t('language.label')}: ${isId ? 'ID' : 'EN'}. ${t('language.switchTo', { name: t(`language.name.${next}`) })}`}
    >
      {isId ? 'ID' : 'EN'}
    </FootButton>
  );
}

export type SellerRailProps = Readonly<{
  ids: ReadonlyArray<NavId>;
  activeId: NavId;
  collapsed: boolean;
  onToggle: () => void;
  kitchen: Kitchen | null;
  /** The week is not published: Menu shows a badge. */
  menuNotPublished: boolean;
  /** No one is signed in (dev): the dev seller picker shows. */
  showPicker: boolean;
}>;

/** The tablet / desktop left panel: 232 px open, 72 px collapsed (handoff, Layout shell). */
export function SellerRail({
  ids,
  activeId,
  collapsed,
  onToggle,
  kitchen,
  menuNotPublished,
  showPicker,
}: SellerRailProps) {
  const { t } = useTranslation();
  const kitchenName = kitchen?.name ?? t('sellerNav.kitchen');
  const label = (id: NavId) =>
    id === 'help'
      ? t(LABEL_KEY.help, { ns: HELP_NS })
      : id === 'about'
        ? t(LABEL_KEY.about, { ns: ABOUT_NS })
        : t(LABEL_KEY[id]);
  const collapseLabel = t(collapsed ? 'sellerNav.expand' : 'sellerNav.collapse');
  const notPublished = t('sellerNav.notPublished');
  const ordersCount = useOrdersCount();
  const unseenNew = useUnseenNewOrders();
  return (
    <Column>
      <Rail aria-label={t('sellerNav.label')} $collapsed={collapsed}>
        <TopBlock $collapsed={collapsed}>
          <LogoBox $collapsed={collapsed}>
            {collapsed ? (
              kitchen?.images?.railIcon ? (
                <ImageSlot
                  fill
                  fit="cover"
                  aspectRatio="1 / 1"
                  src={kitchen.images.railIcon}
                  alt={kitchenName}
                  placeholder=""
                />
              ) : (
                <Initial role="img" aria-label={kitchenName}>
                  <span aria-hidden="true">{initialOf(kitchenName)}</span>
                </Initial>
              )
            ) : (
              <ImageSlot
                fill
                fit="cover"
                aspectRatio="2 / 1"
                src={kitchen?.images?.railImage}
                alt={`${kitchenName} — ${t('sellerNav.railImage')}`}
                placeholder={t('sellerNav.railImageSoon')}
              />
            )}
          </LogoBox>
          {collapsed ? null : (
            <KitchenName>
              <span>{kitchenName}</span>
            </KitchenName>
          )}
        </TopBlock>
        {collapsed ? null : <KitchenSwitcher />}
        <List>
          {ids.map((id) => {
            const flagged = id === 'menu' && menuNotPublished;
            const tip = flagged ? `${label(id)} · ${notPublished}` : label(id);
            return (
              <li key={id}>
                <Tooltip text={collapsed ? tip : undefined}>
                  <Item
                    to={HREF[id]}
                    $active={id === activeId}
                    $collapsed={collapsed}
                    aria-current={id === activeId ? 'page' : undefined}
                  >
                    <NavIcon id={id} />
                    {collapsed ? <Hidden>{tip}</Hidden> : label(id)}
                    {id === 'orders' && ordersCount !== null && !collapsed ? (
                      <Count>{ordersCount}</Count>
                    ) : null}
                    {flagged && !collapsed ? (
                      <Badge>
                        <Icon name="pencil" />
                        {notPublished}
                      </Badge>
                    ) : null}
                    {flagged && collapsed ? <Dot aria-hidden="true" /> : null}
                    {id === 'orders' && unseenNew > 0 ? (
                      <>
                        <Dot aria-hidden="true" />
                        <Hidden>{t('sellerNav.newOrders')}</Hidden>
                      </>
                    ) : null}
                  </Item>
                </Tooltip>
              </li>
            );
          })}
        </List>
        <Foot $collapsed={collapsed}>
          {showPicker && !collapsed ? <SellerPicker /> : null}
          <RailSwitchPerson collapsed={collapsed} />
          {collapsed ? (
            <CompactLanguage />
          ) : (
            <ExpandedLanguage>
              <LanguageSwitch compact />
            </ExpandedLanguage>
          )}
          <Tooltip text={collapsed ? collapseLabel : undefined}>
            <FootButton
              type="button"
              $collapsed={collapsed}
              aria-expanded={!collapsed}
              aria-label={collapseLabel}
              onClick={onToggle}
            >
              <Icon name={collapsed ? 'forward' : 'back'} />
              {collapsed ? null : collapseLabel}
            </FootButton>
          </Tooltip>
        </Foot>
      </Rail>
    </Column>
  );
}
