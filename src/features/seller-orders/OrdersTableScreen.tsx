import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { parseOrderCode } from '../../../shared/orderCode';
import type { MenuView } from '../../../shared/menusContract';
import { Button, EmptyState, Icon, ListWithPanel, Menu } from '../../ui';
import { LiveDot } from '../../components/LiveDot';
import { ScanEntry } from '../../components/scan';
import { SearchIcon } from './PhoneIcons';
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
import { LiveOrderRow } from './LiveOrderRow';
import { NewOrderPanel } from './NewOrderPanel';
import type { OrdersScreenProps } from './OrdersScreen';
import { OrderPanelActions, OrderPanelBody } from './OrderPanelBody';
import { homeKindOf } from './homeState';
import { STATUS_FILTERS, type StatusFilter } from './orderStatus';
import { useLang } from './orderText';
import {
  DevTools,
  useFreshIds,
  useNewOrdersViewed,
  useOrdersPolling,
  useShowDevTools,
  useVisibleOrders,
} from './ordersShared';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import {
  selectCounts,
  selectCurrent,
  selectList,
  selectOrderByCode,
  selectOrders,
  selectPast,
  selectUnpaidCount,
} from './sellerOrdersSelectors';
import {
  currentRequested,
  refreshRequested,
  takingOrdersRequested,
  type SellerOrdersRootState,
} from './sellerOrdersSlice';

// Orders, the home screen on a tablet or computer (plan 001 stage 6; handoff, Home). What it shows
// depends on the menu: first-run checklist, "not published yet", live (list + detail), or the
// cooking day over. Live: list with search, toggles and status tabs, the order beside it (384 px),
// New order as a 560 px slide-over, and the live Dishes panel.

export type OrdersTableScreenProps = OrdersScreenProps &
  Readonly<{
    /** The order whose panel is open, to mark its row. */
    selectedCode?: string;
    /** The Changed and Not paid toggles (in the URL). */
    toggles?: Readonly<{ changed: boolean; unpaid: boolean }>;
    onToggle?: (key: 'changed' | 'unpaid') => void;
    onCloseOrder?: () => void;
    /** The New order slide-over is open (route /seller/new). */
    newOrderOpen?: boolean;
    onCloseNewOrder?: () => void;
  }>;

// Plan 008: the layout gives the page one screen of height, so Head stays put and only the order
// list (inside OrdersBoard) and the order panel scroll. Other states scroll inside Scroll.
const Page = styled.main`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  font-size: 0.9375rem;
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
// Plan 015: one row. Narrow, the search shrinks first, then the button labels drop to their icons.
const Head = styled.header`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px
    ${({ theme }) => theme.spacing.sm};
  container-type: inline-size;

  @container (max-width: 62rem) {
    b {
      display: none;
    }
  }
  /* Plan 022: narrower still (820 px with an order open), the switch keeps only its track. */
  @container (max-width: 44rem) {
    button[role='switch'] > span {
      display: none;
    }
  }
`;
const TitleLine = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Title = styled.h1`
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.25;
`;
const Tools = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Filler = styled.div`
  flex: 1;
`;
const NoLive = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const Ring = styled.span`
  width: 0.75rem;
  height: 0.75rem;
  border: ${({ theme }) => theme.border.focus} solid currentColor;
  border-radius: 50%;
`;
const Switch = styled.button<{ $on: boolean }>`
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
const Filters = styled.div`
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
const Toggle = styled.button<{ $on: boolean }>`
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
const TabToggle = styled(Toggle)`
  flex: none;
  align-self: center;
`;
const Divider = styled.span`
  flex: none;
  align-self: center;
  width: ${({ theme }) => theme.border.hairline};
  height: 1.5rem;
  background: ${({ theme }) => theme.c.line};
`;
// Plan 022: the search field takes the tabs' place, full width, with a close button.
const SearchBar = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.size.pagePadTablet}px ${({ theme }) => theme.spacing.sm};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const IconButton = styled.button`
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
const Tabs = styled.div`
  display: flex;
  flex: none;
  gap: ${({ theme }) => theme.spacing.lg};
  overflow-x: auto;
  padding: 0 ${({ theme }) => theme.size.pagePadTablet}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;
const Tab = styled.button<{ $on: boolean }>`
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
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  color: ${({ theme }) => theme.c.muted};
`;
const ErrorBox = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
`;
const Bottom = styled.div`
  flex: none;
  margin-top: auto;
`;

// The active tab scrolls into view when the row of tabs is wider than the screen.
const showTab = (tab: HTMLElement | null) =>
  tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });

const TAB_FILTERS = STATUS_FILTERS.filter((id) => id !== 'changed');

function TakingOrders({ view }: Readonly<{ view: MenuView }>) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const on = view.menu.takingOrders;
  const flip = useCallback(() => dispatch(takingOrdersRequested({ value: !on })), [dispatch, on]);
  return (
    <Switch
      type="button"
      role="switch"
      aria-label={on ? t('home.takingOrders') : t('home.paused')}
      aria-checked={on}
      $on={on}
      onClick={flip}
    >
      <i aria-hidden="true" />
      <span>{on ? t('home.takingOrders') : t('home.paused')}</span>
    </Switch>
  );
}

type SearchProps = Pick<OrdersTableScreenProps, 'query' | 'onQueryChange'> &
  Readonly<{ autoFocus?: boolean; onEscape?: () => void }>;

function SearchField({ query, onQueryChange, autoFocus, onEscape }: SearchProps) {
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
function Toggles({
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

type BoardProps = OrdersTableScreenProps &
  Readonly<{ readOnly: boolean; searching?: boolean; onEscape?: () => void }>;

/** The orders list with its toggles and tabs, and the order beside it. */
function OrdersBoard({
  readOnly,
  filter,
  query,
  toggles = { changed: false, unpaid: false },
  onToggle,
  onFilterChange,
  onQueryChange,
  onOpenOrder,
  onCloseOrder,
  onShare,
  selectedCode,
  searching = false,
  onEscape,
}: BoardProps) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const counts = useSelector(selectCounts);
  const visible = useVisibleOrders(filter, query, toggles);
  const fresh = useFreshIds();
  const selected = useSelector((state: SellerOrdersRootState) =>
    selectedCode ? selectOrderByCode(state, selectedCode) : undefined,
  );
  const retry = useCallback(() => dispatch(refreshRequested()), [dispatch]);
  const noOrdersAtAll = list.status === 'ready' && counts.all === 0;
  const raw = selectedCode ? (parseOrderCode(selectedCode) ?? selectedCode) : undefined;

  // Bring the open order's row into view inside the list when the page opens on it (a link, a reload).
  useEffect(() => {
    if (!raw || list.status !== 'ready') return;
    const rows = document.querySelectorAll<HTMLElement>('[data-row-id]');
    for (const row of rows) {
      if (row.dataset['rowId'] === raw) {
        row.scrollIntoView?.({ block: 'nearest' });
        break;
      }
    }
  }, [raw, list.status]);

  // Fixed above the list: the status tabs (and, on a finished menu, search and toggles; on a live
  // menu those sit in the page header).
  const listHeader = (
    <>
      {readOnly ? (
        <Filters role="search">
          <SearchField query={query} onQueryChange={onQueryChange} />
          <Toggles toggles={toggles} onToggle={onToggle} />
        </Filters>
      ) : null}
      {searching ? (
        <SearchBar role="search">
          <SearchField query={query} onQueryChange={onQueryChange} autoFocus onEscape={onEscape} />
          <IconButton type="button" aria-label={t('phone.searchClose')} onClick={onEscape}>
            <Icon name="x" />
          </IconButton>
        </SearchBar>
      ) : (
        <Tabs role="group" aria-label={t('live.status')}>
          {TAB_FILTERS.map((id: StatusFilter) => (
            <Tab
              key={id}
              type="button"
              aria-pressed={id === filter}
              $on={id === filter}
              ref={id === filter ? showTab : undefined}
              onClick={() => onFilterChange(id)}
            >
              {t(`filter.${id}`)}
              <span>{counts[id]}</span>
            </Tab>
          ))}
          {readOnly ? null : (
            <>
              <Divider aria-hidden="true" />
              <Toggles tab toggles={toggles} onToggle={onToggle} />
            </>
          )}
        </Tabs>
      )}
    </>
  );
  // The scrolling part: the orders.
  const listNode = (
    <>
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
            onShare && !readOnly ? (
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
      {list.status === 'ready'
        ? visible.map((order) => (
            <LiveOrderRow
              key={order.id}
              order={order}
              selected={order.code === raw}
              isNew={fresh.has(order.id)}
              onOpen={onOpenOrder}
            />
          ))
        : null}
    </>
  );

  let panel = null;
  if (selectedCode) {
    if (selected)
      panel = <OrderPanelBody order={selected} onClose={onCloseOrder ?? (() => undefined)} />;
    else
      panel = (
        <Message role="status">
          {list.status === 'loading' ? t('detail.loading') : t('detail.notFound')}
        </Message>
      );
  }
  return (
    <Board>
      <ListWithPanel
        listHeader={listHeader}
        list={listNode}
        panel={panel}
        panelLabel={t('detail.panelLabel', { code: raw ?? '' })}
        panelAction={selected ? <OrderPanelActions order={selected} /> : undefined}
      />
    </Board>
  );
}

function OrdersTableContent(props: OrdersTableScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const current = useSelector(selectCurrent);
  const past = useSelector(selectPast);
  const orders = useSelector(selectOrders);
  const [showAll, setShowAll] = useState(false);
  const [dishesOpen, setDishesOpen] = useState(false);
  const [searching, setSearching] = useState(props.query !== '');
  const { onQueryChange } = props;
  const closeSearch = useCallback(() => {
    onQueryChange('');
    setSearching(false);
  }, [onQueryChange]);
  const soldTotal = useSoldTotal();
  useOrdersPolling();
  useNewOrdersViewed();
  useEarlierMenus();
  const showDev = useShowDevTools();
  const retryCurrent = useCallback(() => dispatch(currentRequested()), [dispatch]);

  const fetchFailed = list.status === 'error' || (list.status === 'ready' && list.live === 'error');
  const view = current.status === 'ready' ? current.view : null;
  const kind = view
    ? homeKindOf(view, past.status === 'ready' ? past.weeks : null, orders)
    : 'checking';
  const live = kind === 'live';

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
        {showAll ? <OrdersBoard {...props} readOnly /> : null}
      </>
    );
  } else {
    body = <OrdersBoard {...props} readOnly={false} searching={searching} onEscape={closeSearch} />;
  }

  return (
    <Page>
      <FeedbackHost />
      <Head>
        <TitleLine>
          <Title>{t('home.title')}</Title>
          {live ? (
            <LiveDot fetchFailed={fetchFailed} />
          ) : (
            <NoLive>
              <Ring aria-hidden="true" />
              {t('home.noLive')}
            </NoLive>
          )}
          {live && view ? <TakingOrders view={view} /> : null}
        </TitleLine>
        {live && view ? (
          <>
            <Filler />
            <Tools>
              <IconButton
                type="button"
                aria-label={searching ? t('phone.searchClose') : t('phone.searchOpen')}
                aria-expanded={searching}
                onClick={searching ? closeSearch : () => setSearching(true)}
              >
                <SearchIcon />
                {props.query ? <i aria-hidden="true" /> : null}
              </IconButton>
              <ScanEntry
                find={(code) => orders.find((o) => o.code === code)}
                onOpen={props.onOpenOrder}
              />
              {props.onNewOrder ? (
                <Button
                  variant="primary"
                  aria-label={t('live.newOrder')}
                  onClick={props.onNewOrder}
                >
                  <Icon name="plus" />
                  <b>{t('live.newOrder')}</b>
                </Button>
              ) : null}
              <Menu
                label={t('live.more')}
                header={t('home.menuFor', {
                  date: formatDay(view.menu.cookingDate, lang),
                  cutoff: formatDayTime(view.menu.cutoffAt, lang),
                })}
                items={[
                  {
                    label: `${t('dishes.title')} ${soldTotal}`,
                    icon: 'pot',
                    onSelect: () => setDishesOpen(true),
                  },
                  ...(props.onShare
                    ? [{ label: t('live.share'), icon: 'share' as const, onSelect: props.onShare }]
                    : []),
                ]}
              />
            </Tools>
          </>
        ) : (
          <Filler />
        )}
        <BannerToggle />
      </Head>
      {dishesOpen && live ? <DishesSlideOver onClose={() => setDishesOpen(false)} /> : null}
      {kind === 'live' ? body : <Scroll>{body}</Scroll>}
      {props.newOrderOpen && view ? (
        <NewOrderPanel onClose={props.onCloseNewOrder ?? (() => undefined)} />
      ) : null}
      {showDev ? (
        <Bottom>
          <DevTools />
        </Bottom>
      ) : null}
    </Page>
  );
}

export function OrdersTableScreen(props: OrdersTableScreenProps) {
  return (
    <ScreenErrorBoundary>
      <OrdersTableContent {...props} />
    </ScreenErrorBoundary>
  );
}
