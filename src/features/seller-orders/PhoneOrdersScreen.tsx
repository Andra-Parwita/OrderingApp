import { useCallback, useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { Button, BottomSheet, EmptyState, Icon, SheetRow } from '../../ui';
import { LiveDot } from '../../components/LiveDot';
import { BannerToggle } from './BannerToggle';
import { DishesSlideOver, useSoldTotal } from './DishesPanel';
import { FeedbackHost } from './FeedbackHost';
import {
  FinishedHome,
  HomeMessage,
  NotPublishedHome,
  SetupChecklist,
  useEarlierMenus,
} from './HomeStates';
import { SELLER_NS } from './i18n/register';
import { homeKindOf } from './homeState';
import { STATUS_FILTERS, type StatusFilter } from './orderStatus';
import { useLang } from './orderText';
import type { OrdersScreenProps } from './OrdersScreen';
import { DevTools, useOrdersPolling, useShowDevTools, useVisibleOrders } from './ordersShared';
import { ChevronDownIcon, SearchIcon } from './PhoneIcons';
import { PhoneOrderRow } from './PhoneOrderRow';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import {
  selectCounts,
  selectCurrent,
  selectList,
  selectOrders,
  selectPast,
  selectUnpaidCount,
} from './sellerOrdersSelectors';
import { currentRequested, refreshRequested } from './sellerOrdersSlice';

// Orders on a phone (below 600 px; plan 001 stage 11, handoff Home): the 3:1 banner is the layout's;
// then the header, one filter dropdown (a bottom sheet), "N changed", a search icon, and the rows,
// each with a round WhatsApp button. Same URL state as the tablet table.

export type PhoneOrdersScreenProps = OrdersScreenProps &
  Readonly<{
    toggles?: Readonly<{ changed: boolean; unpaid: boolean }>;
    onToggle?: (key: 'changed' | 'unpaid') => void;
  }>;

// Plan 008: the layout gives the page the height between the banner and the bottom bar; the header
// and filter bar stay, only the rows scroll (ListScroll). Other states scroll inside Scroll.
const Page = styled.main`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;
const Board = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;
const ListScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;
const Head = styled.header`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.size.pagePadPhone}px
    ${({ theme }) => theme.spacing.sm};
`;
const TitleLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const TitleGroup = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md};
  min-width: 0;
`;
const Actions = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Title = styled.h1`
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
`;
const SubLine = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.9375rem;
`;
const NoLive = styled(SubLine)`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const FilterBar = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px;
`;
const Dropdown = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  span {
    color: ${({ theme }) => theme.c.muted};
    font-variant-numeric: tabular-nums;
  }
`;
const ChangedToggle = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme, $on }) => ($on ? theme.c.warnTint : 'transparent')};
  color: ${({ theme }) => theme.c.warn};
  font: inherit;
  white-space: nowrap;
  cursor: pointer;

  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const DishesButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
`;
const SearchButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  margin-inline-start: auto;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  cursor: pointer;
`;
const SearchRow = styled.label`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  margin: 0 ${({ theme }) => theme.size.pagePadPhone}px ${({ theme }) => theme.spacing.sm};
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
  input:focus-visible {
    outline: none;
  }
  &:focus-within {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: 0.125rem;
  }
`;
const Rows = styled.div`
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.size.pagePadPhone}px;
  color: ${({ theme }) => theme.c.muted};
`;
const ErrorBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.size.pagePadPhone}px;
`;
const Check = styled.span`
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;

  em {
    color: ${({ theme }) => theme.c.muted};
    font-style: normal;
    font-variant-numeric: tabular-nums;
  }
`;
const SheetGroup = styled.p`
  margin: ${({ theme }) => theme.spacing.md} 0 0;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  font-weight: 700;
`;

const SHEET_FILTERS = STATUS_FILTERS.filter((id) => id !== 'changed');

function PhoneOrdersContent({
  filter,
  query,
  toggles = { changed: false, unpaid: false },
  onToggle,
  onFilterChange,
  onQueryChange,
  onOpenOrder,
  onNewOrder,
  onShare,
}: PhoneOrdersScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const counts = useSelector(selectCounts);
  const unpaid = useSelector(selectUnpaidCount);
  const current = useSelector(selectCurrent);
  const past = useSelector(selectPast);
  const orders = useSelector(selectOrders);
  const visible = useVisibleOrders(filter, query, toggles);
  const [sheet, setSheet] = useState(false);
  const [dishes, setDishes] = useState(false);
  const soldTotal = useSoldTotal();
  const [searching, setSearching] = useState(query !== '');
  const [showAll, setShowAll] = useState(false);
  useOrdersPolling();
  useEarlierMenus();
  const showDev = useShowDevTools();

  const retryCurrent = useCallback(() => dispatch(currentRequested()), [dispatch]);
  const retry = useCallback(() => dispatch(refreshRequested()), [dispatch]);
  const onQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value),
    [onQueryChange],
  );
  const pick = useCallback(
    (id: StatusFilter) => {
      onFilterChange(id);
      setSheet(false);
    },
    [onFilterChange],
  );
  const toggleSearch = useCallback(() => {
    if (searching) onQueryChange('');
    setSearching(!searching);
  }, [searching, onQueryChange]);

  const fetchFailed = list.status === 'error' || (list.status === 'ready' && list.live === 'error');
  const view = current.status === 'ready' ? current.view : null;
  const kind = view
    ? homeKindOf(view, past.status === 'ready' ? past.weeks : null, orders)
    : 'checking';
  const live = kind === 'live';
  const noOrdersAtAll = list.status === 'ready' && counts.all === 0;

  const filterLabel = filter === 'all' ? t('phone.allOrders') : t(`filter.${filter}`);
  const board = (
    <Board>
      <FilterBar role="search">
        <Dropdown
          type="button"
          aria-haspopup="dialog"
          aria-label={`${t('live.status')}: ${filterLabel} ${counts[filter]}`}
          onClick={() => setSheet(true)}
        >
          {filterLabel}
          <span>{counts[filter]}</span>
          <ChevronDownIcon />
        </Dropdown>
        {counts.changed > 0 || toggles.changed ? (
          <ChangedToggle
            type="button"
            $on={toggles.changed}
            aria-pressed={toggles.changed}
            onClick={() => onToggle?.('changed')}
          >
            <Icon name="pencil" />
            {t('phone.changedN', { count: counts.changed })}
          </ChangedToggle>
        ) : null}
        {live ? (
          <DishesButton
            type="button"
            aria-haspopup="dialog"
            aria-label={`${t('dishes.title')} ${soldTotal}`}
            onClick={() => setDishes(true)}
          >
            <Icon name="pot" />
            {soldTotal}
          </DishesButton>
        ) : null}
        <SearchButton
          type="button"
          aria-label={searching ? t('phone.searchClose') : t('phone.searchOpen')}
          aria-expanded={searching}
          onClick={toggleSearch}
        >
          <SearchIcon />
        </SearchButton>
      </FilterBar>
      {searching ? (
        <SearchRow>
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={onQuery}
            placeholder={t('live.search')}
            aria-label={t('live.search')}
            autoComplete="off"
            enterKeyHint="search"
            autoFocus
          />
        </SearchRow>
      ) : null}
      <ListScroll>
        {list.status === 'loading' ? <Message role="status">{t('orders.loading')}</Message> : null}
        {list.status === 'error' ? (
          <ErrorBox role="alert">
            <span>{t('error.load')}</span>
            <Button onClick={retry}>{t('error.retry')}</Button>
          </ErrorBox>
        ) : null}
        {noOrdersAtAll ? (
          <EmptyState
            icon="share"
            title={t('orders.emptyTitle')}
            why={t('orders.emptyHint')}
            action={
              onShare && live ? (
                <Button variant="primary" onClick={onShare}>
                  <Icon name="chat" />
                  {t('orders.shareOnWhatsApp')}
                </Button>
              ) : undefined
            }
          />
        ) : null}
        {list.status === 'ready' && counts.all > 0 && visible.length === 0 ? (
          <Message>{t('orders.empty')}</Message>
        ) : null}
        {list.status === 'ready' ? (
          <Rows>
            {visible.map((order) => (
              <PhoneOrderRow key={order.id} order={order} onOpen={onOpenOrder} />
            ))}
          </Rows>
        ) : null}
      </ListScroll>
    </Board>
  );

  let body: ReactNode;
  if (current.status === 'error') {
    body = (
      <ErrorBox role="alert">
        <span>{t('home.loadError')}</span>
        <Button onClick={retryCurrent}>{t('error.retry')}</Button>
      </ErrorBox>
    );
  } else if (!view || kind === 'checking') {
    body = <HomeMessage text={t('home.loading')} />;
  } else if (kind === 'first_run') {
    body = <SetupChecklist view={view} />;
  } else if (kind === 'not_published') {
    body = <NotPublishedHome view={view} />;
  } else if (kind === 'finished') {
    body = (
      <>
        <FinishedHome view={view} showAll={showAll} onToggleAll={() => setShowAll((on) => !on)} />
        {showAll ? board : null}
      </>
    );
  } else {
    body = board;
  }

  return (
    <Page>
      <FeedbackHost />
      <Head>
        <TitleLine>
          <TitleGroup>
            <Title>{t('home.title')}</Title>
            {live ? <LiveDot fetchFailed={fetchFailed} /> : null}
          </TitleGroup>
          <Actions>
            {live && onNewOrder ? (
              <Button variant="primary" onClick={onNewOrder}>
                <Icon name="plus" />
                {t('live.newOrder')}
              </Button>
            ) : null}
            <BannerToggle />
          </Actions>
        </TitleLine>
        {live && view ? (
          <SubLine>
            {t('home.menuFor', {
              date: formatDay(view.menu.cookingDate, lang),
              cutoff: formatDayTime(view.menu.cutoffAt, lang),
            })}
          </SubLine>
        ) : null}
        {!live && view ? <NoLive>{t('home.noLive')}</NoLive> : null}
      </Head>
      {kind === 'live' ? body : <Scroll>{body}</Scroll>}
      {dishes && live ? <DishesSlideOver width="100%" onClose={() => setDishes(false)} /> : null}
      {sheet ? (
        <BottomSheet title={t('phone.filterTitle')} onClose={() => setSheet(false)}>
          {SHEET_FILTERS.map((id) => (
            <SheetRow key={id} type="button" $selected={id === filter} onClick={() => pick(id)}>
              <Check>
                {id === 'all' ? t('phone.allOrders') : t(`filter.${id}`)}
                <em>{counts[id]}</em>
              </Check>
              {id === filter ? <Icon name="check" /> : null}
            </SheetRow>
          ))}
          <SheetGroup>{t('phone.moreFilters')}</SheetGroup>
          <SheetRow
            type="button"
            $selected={toggles.changed}
            aria-pressed={toggles.changed}
            onClick={() => onToggle?.('changed')}
          >
            <Check>
              {t('live.changed')}
              <em>{counts.changed}</em>
            </Check>
            {toggles.changed ? <Icon name="check" /> : null}
          </SheetRow>
          <SheetRow
            type="button"
            $selected={toggles.unpaid}
            aria-pressed={toggles.unpaid}
            onClick={() => onToggle?.('unpaid')}
          >
            <Check>
              {t('live.notPaid')}
              <em>{unpaid}</em>
            </Check>
            {toggles.unpaid ? <Icon name="check" /> : null}
          </SheetRow>
        </BottomSheet>
      ) : null}
      {showDev ? <DevTools /> : null}
    </Page>
  );
}

export function PhoneOrdersScreen(props: PhoneOrdersScreenProps) {
  return (
    <ScreenErrorBoundary>
      <PhoneOrdersContent {...props} />
    </ScreenErrorBoundary>
  );
}
