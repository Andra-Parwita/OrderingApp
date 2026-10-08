import { useCallback, useEffect, useMemo, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import {
  Button,
  Segmented,
  TabBar,
  TextField,
  type SegmentedOption,
  type TabBarItem,
} from '../../ui';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { SELLER_NS } from './i18n/register';
import { formatDay } from '../../../shared/dates';
import { STATUS_FILTERS, type StatusFilter } from './orderStatus';
import { useLang } from './orderText';
import { OrderRow } from './OrderRow';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import {
  selectCookingDate,
  selectCounts,
  selectList,
  selectOrders,
  visibleOrders,
} from './sellerOrdersSelectors';
import {
  devResetRequested,
  devSampleOrdersRequested,
  pollingStarted,
  pollingStopped,
  refreshRequested,
} from './sellerOrdersSlice';

/** The filter and the search text come from the URL (the route wrapper owns them). */
export type OrdersScreenProps = Readonly<{
  filter: StatusFilter;
  query: string;
  onFilterChange: (next: StatusFilter) => void;
  onQueryChange: (next: string) => void;
  onOpenOrder: (code: string) => void;
}>;

const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: min(100%, 45rem);
  margin: 0 auto;
`;
const Head = styled.header`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.sm};
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Tools = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const LiveText = styled.span<{ $ok: boolean }>`
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme, $ok }) => ($ok ? theme.colour.accent : theme.status.cancelled.fg)};
  white-space: nowrap;
`;
const Block = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
`;
const Scroll = styled.div`
  overflow-x: auto;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
`;
const Grow = styled.div`
  flex: 1;
`;
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const ErrorBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
`;
const DevBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const Bottom = styled.footer`
  position: sticky;
  bottom: 0;
  background: ${({ theme }) => theme.colour.bg};
`;

// The other tabs arrive with later batches (cook list, hand-over, menu, more); inert until then.
// "+ Add order" belongs to batch 2 and is intentionally not here.
const TAB_IDS = ['orders', 'cook', 'handover', 'menu', 'more'] as const;

function OrdersContent({
  filter,
  query,
  onFilterChange,
  onQueryChange,
  onOpenOrder,
}: OrdersScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const counts = useSelector(selectCounts);
  const orders = useSelector(selectOrders);
  const visible = useMemo(() => visibleOrders(orders, filter, query), [orders, filter, query]);
  const cookingDate = useSelector(selectCookingDate);

  // Polling lives in the saga; the screen only says when it is shown.
  useEffect(() => {
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);

  const filterOptions = useMemo<Array<SegmentedOption<StatusFilter>>>(
    () => STATUS_FILTERS.map((id) => ({ value: id, label: `${t(`filter.${id}`)} ${counts[id]}` })),
    [t, counts],
  );
  const tabs = useMemo<Array<TabBarItem>>(
    () =>
      TAB_IDS.map((id) =>
        id === 'orders'
          ? { id, label: t(`tabs.${id}`), href: '/seller' }
          : {
              id,
              label: t(`tabs.${id}`),
              href: '/seller',
              disabled: true,
              hint: t('tabs.comingSoon'),
            },
      ),
    [t],
  );

  const onQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value),
    [onQueryChange],
  );
  const showOrdered = useCallback(() => onFilterChange('ordered'), [onFilterChange]);
  const retry = useCallback(() => dispatch(refreshRequested()), [dispatch]);
  const addSamples = useCallback(() => dispatch(devSampleOrdersRequested()), [dispatch]);
  const reset = useCallback(() => dispatch(devResetRequested()), [dispatch]);

  const title =
    cookingDate !== null
      ? t('orders.titleWithDate', { date: formatDay(cookingDate, lang) })
      : t('orders.title');
  const liveOk = list.status === 'ready' && list.live === 'ok';

  return (
    <Page>
      <Head>
        <Title>{title}</Title>
        <Tools>
          <LiveText $ok={liveOk} role="status">
            ● {liveOk ? t('orders.live') : t('orders.offline')}
          </LiveText>
          <LanguageSwitch />
        </Tools>
      </Head>
      {counts.ordered > 0 ? (
        <Block>
          <Button variant="secondary" fullWidth onClick={showOrdered}>
            {t('orders.notConfirmed', { count: counts.ordered })} · {t('orders.show')}
          </Button>
        </Block>
      ) : null}
      <Scroll>
        <Segmented
          options={filterOptions}
          value={filter}
          onChange={onFilterChange}
          label={t('orders.filterLabel')}
        />
      </Scroll>
      <Block>
        <TextField
          label={t('orders.searchLabel')}
          helper={t('orders.searchHelper')}
          value={query}
          onChange={onQuery}
          autoComplete="off"
          enterKeyHint="search"
        />
      </Block>
      <Grow>
        {list.status === 'loading' ? <Message role="status">{t('orders.loading')}</Message> : null}
        {list.status === 'error' ? (
          <ErrorBox role="alert">
            <span>{t('error.load')}</span>
            <Button onClick={retry}>{t('error.retry')}</Button>
          </ErrorBox>
        ) : null}
        {list.status === 'ready' && visible.length === 0 ? (
          <Message>{t('orders.empty')}</Message>
        ) : null}
        {list.status === 'ready'
          ? visible.map((order) => <OrderRow key={order.id} order={order} onOpen={onOpenOrder} />)
          : null}
      </Grow>
      {import.meta.env.DEV ? (
        <DevBar>
          <Button onClick={addSamples}>{t('orders.devSample')}</Button>
          <Button variant="quiet" onClick={reset}>
            {t('orders.devReset')}
          </Button>
        </DevBar>
      ) : null}
      <Bottom>
        <TabBar items={tabs} activeId="orders" label={t('orders.tabsLabel')} />
      </Bottom>
    </Page>
  );
}

export function OrdersScreen(props: OrdersScreenProps) {
  return (
    <ScreenErrorBoundary>
      <OrdersContent {...props} />
    </ScreenErrorBoundary>
  );
}
