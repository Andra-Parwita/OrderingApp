import { useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { MenuView } from '../../../shared/menusContract';
import { Icon } from '../../ui';
import { SELLER_NS } from './i18n/register';
import type { OrdersTableScreenProps } from './ordersTableProps';
import { selectControlSaving, selectCounts, selectUnpaidCount } from './sellerOrdersSelectors';
import { takingOrdersRequested } from './sellerOrdersSlice';

export const Switch = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 600;
  cursor: pointer;

  i {
    position: relative;
    width: 2.5rem;
    height: 1.5rem;
    border: ${({ theme }) => theme.border.hairline} solid
      ${({ theme, $on }) => ($on ? theme.c.fill : theme.c.ctrl)};
    border-radius: ${({ theme }) => theme.radius.pill};
    background: ${({ theme, $on }) => ($on ? theme.c.fill : 'transparent')};
  }
  i::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: ${({ $on }) => ($on ? '18px' : '2px')};
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 50%;
    background: ${({ theme, $on }) => ($on ? theme.c.on : theme.c.ctrl)};
    transition: left ${({ theme }) => theme.motion.fast};
  }
`;
export const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadTablet}px;
`;
const Search = styled.label`
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 6rem;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  color: ${({ theme }) => theme.c.muted};

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.c.text};
    font: inherit;
  }
`;
export const Toggle = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $on }) => ($on ? theme.c.fill : theme.c.ctrl)};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme, $on }) => ($on ? theme.c.tint : 'transparent')};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  svg {
    width: 1rem;
    height: 1rem;
  }
  b {
    font-weight: inherit;
  }
  span {
    color: ${({ theme }) => theme.c.muted};
    font-variant-numeric: tabular-nums;
  }
`;
export const TabToggle = styled(Toggle)`
  flex: none;
  align-self: center;
`;
export const Divider = styled.span`
  flex: none;
  align-self: center;
  width: ${({ theme }) => theme.border.hairline};
  height: 1.5rem;
  background: ${({ theme }) => theme.c.line};
`;
// Plan 022: the search field takes the tabs' place, full width, with a close button.
export const SearchBar = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.size.pagePadTablet}px ${({ theme }) => theme.spacing.sm};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
export const IconButton = styled.button`
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  cursor: pointer;

  &[aria-expanded='true'] {
    background: ${({ theme }) => theme.c.surf2};
  }
  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  i {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.fill};
  }
`;
export const Tabs = styled.div`
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 0 ${({ theme }) => theme.spacing.lg};
  padding: 0 ${({ theme }) => theme.size.pagePadTablet}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
// Plan 104: the divider and the chips travel together, so a narrow list wraps them to a line of
// their own instead of clipping "Not paid".
export const ChipGroup = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
`;
export const Tab = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: 0;
  border-bottom: ${({ theme }) => theme.border.tab} solid
    ${({ theme, $on }) => ($on ? theme.c.fill : 'transparent')};
  background: transparent;
  color: ${({ theme, $on }) => ($on ? theme.c.text : theme.c.muted)};
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  span {
    min-width: 1.5rem;
    padding: 0 ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.radius.pill};
    background: ${({ theme, $on }) => ($on ? theme.c.tint : theme.c.surf2)};
    color: ${({ theme, $on }) => ($on ? theme.c.atext : theme.c.muted)};
    font-size: 0.8125rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
`;

export function TakingOrders({ view }: Readonly<{ view: MenuView }>) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const on = view.menu.takingOrders;
  const saving = useSelector(selectControlSaving('taking'));
  const flip = useCallback(() => dispatch(takingOrdersRequested({ value: !on })), [dispatch, on]);
  return (
    <Switch
      type="button"
      role="switch"
      aria-label={on ? t('home.takingOrders') : t('home.paused')}
      aria-checked={on}
      $on={on}
      disabled={saving}
      aria-busy={saving}
      onClick={flip}
    >
      <i aria-hidden="true" />
      <span>{on ? t('home.takingOrders') : t('home.paused')}</span>
    </Switch>
  );
}

type SearchProps = Pick<OrdersTableScreenProps, 'query' | 'onQueryChange'> &
  Readonly<{ autoFocus?: boolean; onEscape?: () => void }>;

export function SearchField({ query, onQueryChange, autoFocus, onEscape }: SearchProps) {
  const { t } = useTranslation(SELLER_NS);
  const onQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value),
    [onQueryChange],
  );
  return (
    <Search>
      <Icon name="list" />
      <input
        type="search"
        value={query}
        onChange={onQuery}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && onEscape) {
            event.preventDefault();
            onEscape();
          }
        }}
        placeholder={t('live.search')}
        aria-label={t('live.search')}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
      />
    </Search>
  );
}

/** The Changed and Not paid toggles (aria-pressed). */
export function Toggles({
  toggles = { changed: false, unpaid: false },
  onToggle,
  tab = false,
}: Pick<OrdersTableScreenProps, 'toggles' | 'onToggle'> & Readonly<{ tab?: boolean }>) {
  const { t } = useTranslation(SELLER_NS);
  const counts = useSelector(selectCounts);
  const unpaid = useSelector(selectUnpaidCount);
  const Chip = tab ? TabToggle : Toggle;
  return (
    <>
      <Chip
        type="button"
        aria-pressed={toggles.changed}
        aria-label={`${t('live.changed')} ${counts.changed}`}
        $on={toggles.changed}
        onClick={() => onToggle?.('changed')}
      >
        <Icon name="pencil" />
        <b>{t('live.changed')}</b>
        <span>{counts.changed}</span>
      </Chip>
      <Chip
        type="button"
        aria-pressed={toggles.unpaid}
        aria-label={`${t('live.notPaid')} ${unpaid}`}
        $on={toggles.unpaid}
        onClick={() => onToggle?.('unpaid')}
      >
        <Icon name="coin" />
        <b>{t('live.notPaid')}</b>
        <span>{unpaid}</span>
      </Chip>
    </>
  );
}
