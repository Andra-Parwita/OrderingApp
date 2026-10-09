import { useCallback, useContext, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactReduxContext } from 'react-redux';
import { Link } from 'react-router';
import { styled } from 'styled-components';
import type { Kitchen } from '../../shared/domain';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { selectOrdersCount, type SellerOrdersRootState } from '../features/seller-orders';
import { SellerPicker } from '../components/SellerPicker';
import { Icon, ImageSlot, Tooltip } from '../ui';
import { HREF, ICON, type NavId } from './sellerNav';
import { RailSwitchPerson } from './SwitchPerson';

const LABEL_KEY: Readonly<Record<NavId, string>> = {
  orders: 'sellerNav.navOrders',
  kitchen: 'sellerNav.navKitchen',
  handover: 'sellerNav.navHandover',
  menu: 'sellerNav.navMenu',
  settings: 'sellerNav.navSettings',
};

const Column = styled.div`
  border-right: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.panel};
`;
const Rail = styled.nav<{ $collapsed: boolean }>`
  position: sticky;
  top: 0;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  width: ${({ $collapsed, theme }) => ($collapsed ? theme.size.navCollapsed : theme.size.navOpen)}px;
  height: 100dvh;
  padding: ${({ theme }) => theme.spacing.lg}
    ${({ $collapsed, theme }) => ($collapsed ? theme.spacing.sm : theme.spacing.md)};
  overflow-x: clip;
  overflow-y: auto;
  transition: width 150ms ease;
`;
const KitchenName = styled.p`
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  overflow: hidden;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
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
const ImageBox = styled.div`
  margin: calc(-1 * ${({ theme }) => theme.spacing.lg})
    calc(-1 * ${({ theme }) => theme.spacing.md}) 0;
`;
const IconBox = styled.div`
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
  const label = (id: NavId) => t(LABEL_KEY[id]);
  const collapseLabel = t(collapsed ? 'sellerNav.expand' : 'sellerNav.collapse');
  const notPublished = t('sellerNav.notPublished');
  const ordersCount = useOrdersCount();
  return (
    <Column>
      <Rail aria-label={t('sellerNav.label')} $collapsed={collapsed}>
        {collapsed ? (
          <IconBox>
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
          </IconBox>
        ) : (
          <ImageBox>
            <ImageSlot
              aspectRatio="2 / 1"
              src={kitchen?.images?.railImage}
              alt={`${kitchenName} — ${t('sellerNav.railImage')}`}
              placeholder={t('sellerNav.railImageSoon')}
            />
          </ImageBox>
        )}
        {collapsed ? null : <KitchenName>{kitchenName}</KitchenName>}
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
                    <Icon name={ICON[id]} />
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
