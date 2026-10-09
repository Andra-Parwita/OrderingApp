import { useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { Button, TextField } from '../../ui';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { SELLER_NS } from './i18n/register';
import { formatDay } from '../../../shared/dates';
import { STATUS_FILTERS, type StatusFilter } from './orderStatus';
import {
  DevTools,
  FilterChip,
  useOrdersPolling,
  useShowDevTools,
  useVisibleOrders,
} from './ordersShared';
import { useLang } from './orderText';
import { OrderRow } from './OrderRow';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import { selectCookingDate, selectCounts, selectList } from './sellerOrdersSelectors';
import { refreshRequested } from './sellerOrdersSlice';

/** The filter and the search text come from the URL (the route wrapper owns them). */
export type OrdersScreenProps = Readonly<{
  /** Shows the "+ New order" button when given (the route wrapper wires it in 4.4). */
  onNewOrder?: () => void;
  /** Shows a quiet link to the share-menu screen when given. */
  onShare?: () => void;
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
  flex-wrap: wrap;
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
  flex-wrap: wrap;
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
const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
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
function OrdersContent({
  filter,
  query,
  onFilterChange,
  onQueryChange,
  onOpenOrder,
  onNewOrder,
  onShare,
}: OrdersScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const counts = useSelector(selectCounts);
  const visible = useVisibleOrders(filter, query);
  const cookingDate = useSelector(selectCookingDate);

  useOrdersPolling();
  const showDev = useShowDevTools();

  const onQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value),
    [onQueryChange],
  );
  const showOrdered = useCallback(() => onFilterChange('ordered'), [onFilterChange]);
  const retry = useCallback(() => dispatch(refreshRequested()), [dispatch]);

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
          {onShare ? (
            <Button variant="quiet" onClick={onShare}>
              {t('orders.share')}
            </Button>
          ) : null}
          {onNewOrder ? <Button onClick={onNewOrder}>{t('orders.newOrder')}</Button> : null}
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
      <Chips role="group" aria-label={t('orders.filterLabel')}>
        {STATUS_FILTERS.map((id) => (
          <FilterChip
            key={id}
            id={id}
            label={`${t(`filter.${id}`)} ${counts[id]}`}
            pressed={id === filter}
            onSelect={onFilterChange}
          />
        ))}
      </Chips>
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
      {showDev ? <DevTools /> : null}
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
