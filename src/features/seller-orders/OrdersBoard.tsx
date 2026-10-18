import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { parseOrderCode } from '../../../shared/orderCode';
import { Button, EmptyState, Icon, ListWithPanel } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { LiveOrderRow } from './LiveOrderRow';
import { OrderPanelActions, OrderPanelBody, OrderPanelHeader } from './OrderPanelBody';
import {
  ChipGroup,
  Divider,
  Filters,
  IconButton,
  SearchBar,
  SearchField,
  Tab,
  Tabs,
  Toggles,
} from './OrdersFilters';
import type { OrdersTableScreenProps } from './ordersTableProps';
import { STATUS_FILTERS, type StatusFilter } from './orderStatus';
import { useFreshIds, useVisibleOrders } from './ordersShared';
import { selectCounts, selectList, selectOrderByCode } from './sellerOrdersSelectors';
import { refreshRequested, type SellerOrdersRootState } from './sellerOrdersSlice';

const Board = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  color: ${({ theme }) => theme.c.muted};
`;
export const ErrorBox = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
`;

// The active tab scrolls into view when the row of tabs is wider than the screen.
const showTab = (tab: HTMLElement | null) =>
  tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });

const TAB_FILTERS = STATUS_FILTERS.filter((id) => id !== 'changed');

type BoardProps = OrdersTableScreenProps &
  Readonly<{ readOnly: boolean; searching?: boolean; onEscape?: () => void }>;

/** The orders list with its toggles and tabs, and the order beside it. */
export function OrdersBoard({
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
  const noOrdersAtAll = list.status === 'ready' && counts.all + counts.cancelled === 0;
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
            <ChipGroup>
              <Divider aria-hidden="true" />
              <Toggles tab toggles={toggles} onToggle={onToggle} />
            </ChipGroup>
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
      {list.status === 'ready' && counts.all + counts.cancelled > 0 && visible.length === 0 ? (
        <Message>{t('orders.empty')}</Message>
      ) : null}
      {list.status === 'ready'
        ? visible.map((order) => (
            <LiveOrderRow
              key={order.id}
              order={order}
              selected={order.code === raw}
              isNew={fresh.has(order.id)}
              panelOpen={Boolean(selectedCode)}
              onOpen={onOpenOrder}
            />
          ))
        : null}
    </>
  );

  let panel = null;
  if (selectedCode) {
    if (selected) panel = <OrderPanelBody order={selected} withHeader={false} />;
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
        panelHeader={
          selected ? (
            <OrderPanelHeader order={selected} onClose={onCloseOrder ?? (() => undefined)} />
          ) : undefined
        }
        panelAction={selected ? <OrderPanelActions order={selected} /> : undefined}
      />
    </Board>
  );
}
