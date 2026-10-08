import { useCallback, useMemo, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import type { Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import {
  Button,
  Icon,
  Pill,
  Table,
  TableCell,
  TableRow,
  TextField,
  type IconName,
  type TableColumn,
} from '../../ui';
import { SELLER_NS } from './i18n/register';
import { attentionFlag, type AttentionFlag } from './customerKind';
import { STATUS_FILTERS } from './orderStatus';
import { DevTools, FilterChip, useOrdersPolling, useVisibleOrders } from './ordersShared';
import type { OrdersScreenProps } from './OrdersScreen';
import { itemsSummary, orderTotalCents, useLang } from './orderText';
import { toneOf } from './orderStatus';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import { selectCookingDate, selectCounts, selectList } from './sellerOrdersSelectors';
import { refreshRequested } from './sellerOrdersSlice';

// Desktop orders (A1-1, A1-4): one simple table; a click opens the slide-over. At most six
// columns, plain words, one "needs attention" flag per row (D-030, D-031). Order, name, total,
// status and flag never truncate; only "what they ordered" gives way first, then names, status and
// flag wrap onto a second line so the table fits 1024 px (D-038).

export type OrdersTableScreenProps = OrdersScreenProps &
  Readonly<{
    /** The order whose panel is open, to mark its row. */
    selectedCode?: string;
  }>;

// The column that takes the rest would squeeze the name to its floor, so the floor grows with the
// screen: about nine characters per line at 1024 px, roomy from 1366 px.
const NAME_MIN_WIDTH = 'clamp(7rem, 14vw, 14rem)';

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 100dvh;
  padding: ${({ theme }) => theme.spacing.xl};
  font-size: ${({ theme }) => theme.type.size.base};
`;
const Head = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Tools = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const LiveText = styled.span<{ $ok: boolean }>`
  color: ${({ theme, $ok }) => ($ok ? theme.colour.accent : theme.status.cancelled.fg)};
  white-space: nowrap;
`;
const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const SearchBox = styled.div`
  max-width: 27.5rem;
`;
const Flag = styled.span<{ $none?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme, $none }) => ($none ? theme.colour.textMuted : theme.colour.text)};
  font-weight: ${({ theme, $none }) =>
    $none ? theme.type.weight.regular : theme.type.weight.strong};
`;
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  max-width: 28.75rem;
  margin: ${({ theme }) => theme.spacing.xxl} auto;
  text-align: center;
`;
const EmptyIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colour.surfaceAlt};
  color: ${({ theme }) => theme.colour.textMuted};

  svg {
    width: 2.25rem;
    height: 2.25rem;
  }
`;
const EmptyTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
`;
const EmptyHint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const ErrorBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Bottom = styled.div`
  margin-top: auto;
`;

const FLAG_ICON: Readonly<Record<AttentionFlag, IconName>> = {
  new: 'star',
  edited: 'pencil',
  note: 'note',
  locked: 'lock',
};

type OrderTableRowProps = Readonly<{
  order: Order;
  selected: boolean;
  onOpen: (code: string) => void;
}>;

function OrderTableRow({ order, selected, onOpen }: OrderTableRowProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const flag = attentionFlag(order);
  const items = itemsSummary(order, lang);
  return (
    <TableRow rowId={order.code} selected={selected} onOpen={onOpen}>
      <TableCell strong>{formatOrderCode(order.code)}</TableCell>
      <TableCell wrap minWidth={NAME_MIN_WIDTH} breakWords>
        {order.firstName}
      </TableCell>
      <TableCell fullText={items}>{items}</TableCell>
      <TableCell align="end">{formatMoney(orderTotalCents(order), lang)}</TableCell>
      <TableCell wrap minWidth="6rem">
        <Pill large wrap tone={toneOf(order.status)}>
          {t(`status.${order.status}`)}
        </Pill>
      </TableCell>
      <TableCell wrap minWidth="6rem">
        {flag ? (
          <Flag>
            <Icon name={FLAG_ICON[flag]} />
            {t(`attention.${flag}`)}
          </Flag>
        ) : (
          <Flag $none>{t('attention.none')}</Flag>
        )}
      </TableCell>
    </TableRow>
  );
}

function OrdersTableContent({
  filter,
  query,
  onFilterChange,
  onQueryChange,
  onOpenOrder,
  onNewOrder,
  onShare,
  selectedCode,
}: OrdersTableScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const counts = useSelector(selectCounts);
  const visible = useVisibleOrders(filter, query);
  const cookingDate = useSelector(selectCookingDate);
  useOrdersPolling();

  const onQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value),
    [onQueryChange],
  );
  const retry = useCallback(() => dispatch(refreshRequested()), [dispatch]);

  const columns = useMemo<Array<TableColumn>>(
    () => [
      { id: 'code', header: t('orders.colCode') },
      { id: 'name', header: t('orders.colName') },
      { id: 'items', header: t('orders.colItems'), width: '100%' },
      { id: 'total', header: t('orders.colTotal'), align: 'end' },
      { id: 'status', header: t('orders.colStatus') },
      { id: 'attention', header: t('orders.colAttention') },
    ],
    [t],
  );

  const title =
    cookingDate !== null
      ? t('orders.titleWithDate', { date: formatDay(cookingDate, lang) })
      : t('orders.title');
  const liveOk = list.status === 'ready' && list.live === 'ok';
  const noOrdersAtAll = list.status === 'ready' && counts.all === 0;

  return (
    <Page>
      <Head>
        <Title>{title}</Title>
        <Tools>
          <LiveText $ok={liveOk} role="status">
            ● {liveOk ? t('orders.live') : t('orders.offline')}
          </LiveText>
          {onShare ? (
            <Button variant="quiet" onClick={onShare}>
              {t('orders.share')}
            </Button>
          ) : null}
          {onNewOrder ? (
            <Button variant="primary" onClick={onNewOrder}>
              {t('orders.newOrder')}
            </Button>
          ) : null}
        </Tools>
      </Head>
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
      <SearchBox>
        <TextField
          label={t('orders.findLabel')}
          value={query}
          onChange={onQuery}
          autoComplete="off"
          enterKeyHint="search"
        />
      </SearchBox>

      {list.status === 'loading' ? <Message role="status">{t('orders.loading')}</Message> : null}
      {list.status === 'error' ? (
        <ErrorBox role="alert">
          <span>{t('error.load')}</span>
          <Button onClick={retry}>{t('error.retry')}</Button>
        </ErrorBox>
      ) : null}
      {noOrdersAtAll ? (
        <Empty>
          <EmptyIcon>
            <Icon name="share" />
          </EmptyIcon>
          <EmptyTitle>{t('orders.emptyTitle')}</EmptyTitle>
          <EmptyHint>{t('orders.emptyHint')}</EmptyHint>
          {onShare ? (
            <Button variant="primary" onClick={onShare}>
              <Icon name="chat" />
              {t('orders.shareOnWhatsApp')}
            </Button>
          ) : null}
        </Empty>
      ) : null}
      {list.status === 'ready' && counts.all > 0 ? (
        <>
          <Table label={t('orders.tableLabel')} columns={columns}>
            {visible.map((order) => (
              <OrderTableRow
                key={order.id}
                order={order}
                selected={order.code === selectedCode}
                onOpen={onOpenOrder}
              />
            ))}
          </Table>
          {visible.length === 0 ? <Message>{t('orders.empty')}</Message> : null}
        </>
      ) : null}
      {import.meta.env.DEV ? (
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
