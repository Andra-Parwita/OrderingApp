import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { Button, Icon, Menu } from '../../ui';
import { LiveDot } from '../../components/LiveDot';
import { ScanEntry } from '../../components/scan';
import { SearchIcon } from './PhoneIcons';
import { BannerToggle } from './BannerToggle';
import { DishesSlideOver, useSoldTotal } from './DishesPanel';
import { FeedbackHost } from './FeedbackHost';
import { FinishedHome, HomeMessage, NoMenuRunning, useEarlierMenus } from './HomeStates';
import { useReadOnlyOrders } from './orderAccess';
import { SELLER_NS } from './i18n/register';
import { NewOrderPanel } from './NewOrderPanel';
import { ErrorBox, OrdersBoard } from './OrdersBoard';
import { IconButton, TakingOrders } from './OrdersFilters';
import type { OrdersTableScreenProps } from './ordersTableProps';
import { homeKindOf } from './homeState';
import { useLang } from './orderText';
import { DevTools, useNewOrdersViewed, useOrdersPolling, useShowDevTools } from './ordersShared';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import { selectCurrent, selectList, selectOrders, selectPast } from './sellerOrdersSelectors';
import { currentRequested } from './sellerOrdersSlice';

// Orders, the home screen on a tablet or computer (plan 001 stage 6; handoff, Home). What it shows
// depends on the menu: first-run checklist, "not published yet", live (list + detail), or the
// cooking day over. Live: list with search, toggles and status tabs, the order beside it (384 px),
// New order as a 560 px slide-over, and the live Dishes panel.

export type { OrdersTableScreenProps } from './ordersTableProps';

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
const Bottom = styled.div`
  flex: none;
  margin-top: auto;
`;

function OrdersTableContent(props: OrdersTableScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const current = useSelector(selectCurrent);
  const past = useSelector(selectPast);
  // A helper may not read earlier menus: for them there are none to wait for.
  const readOnly = useReadOnlyOrders();
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
  const navigate = useNavigate();
  useOrdersPolling();
  useNewOrdersViewed();
  useEarlierMenus();
  const showDev = useShowDevTools();
  const retryCurrent = useCallback(() => dispatch(currentRequested()), [dispatch]);

  const fetchFailed = list.status === 'error' || (list.status === 'ready' && list.live === 'error');
  const view = current.status === 'ready' ? current.view : null;
  const kind = view
    ? homeKindOf(view, past.status === 'ready' ? past.weeks : readOnly ? [] : null, orders)
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
  } else if (kind === 'first_run' || kind === 'not_published') {
    body = <NoMenuRunning phone={false} />;
  } else if (kind === 'finished') {
    body = (
      <>
        <FinishedHome
          view={view}
          showAll={showAll}
          onToggleAll={() => setShowAll((on) => !on)}
          phone={false}
        />
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
          {live && view && !readOnly ? <TakingOrders view={view} /> : null}
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
              {readOnly ? null : (
                <Button
                  aria-label={t('print.print')}
                  onClick={() => void navigate('/seller/orders/print')}
                >
                  <Icon name="print" />
                  <b>{t('print.print')}</b>
                </Button>
              )}
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
                  ...(props.onDeliveries
                    ? [
                        {
                          label: t('address.deliveries'),
                          icon: 'truck' as const,
                          onSelect: props.onDeliveries,
                        },
                      ]
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
