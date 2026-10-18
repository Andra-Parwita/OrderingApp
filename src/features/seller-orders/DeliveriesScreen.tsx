import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { setOrderStatus } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button } from '../../ui';
import { DeliveryRow } from './DeliveryRow';
import { usePrivateToday } from './usePrivateToday';
import { SELLER_NS } from './i18n/register';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import { selectOrders } from './sellerOrdersSelectors';
import { pollingStarted, pollingStopped, statusChangeRequested } from './sellerOrdersSlice';
import { SCREEN_HEIGHT } from '../../theme/screen';

// Plan 071 stage 3: the cooking day's deliveries in one list: who, where (Directions), what, and a
// Delivered tick. Team-only; the addresses come with the orders from the server.

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${SCREEN_HEIGHT};
  padding: ${({ theme }) => theme.size.pagePadPhone}px;
`;
const Head = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  h1 {
    margin: 0;
    font-size: 1.25rem;
  }
`;
const List = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.c.muted};
`;

function DeliveriesContent({ onBack }: Readonly<{ onBack: () => void }>) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const orders = useSelector(selectOrders);
  useEffect(() => {
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);
  // Plan 081: today's private deliveries join the list (sorted by event time, after nothing special).
  const { orders: privateToday, reload } = usePrivateToday();
  const deliveries = useMemo(
    () =>
      [...orders, ...privateToday]
        .filter((order) => order.fulfilment === 'delivery' && order.status !== 'cancelled')
        .sort(
          (a, b) =>
            Number(a.status === 'delivered') - Number(b.status === 'delivered') ||
            (a.private?.eventTime ?? '').localeCompare(b.private?.eventTime ?? '') ||
            a.createdAt.localeCompare(b.createdAt),
        ),
    [orders, privateToday],
  );
  const open = deliveries.filter((order) => order.status !== 'delivered').length;
  const done = useCallback(
    (order: (typeof orders)[number]) => {
      if (order.private) {
        // A private order is not in the menu's list: move it directly, then reload today's.
        void setOrderStatus(order.code, 'delivered', undefined, currentSellerSlug(), true).then(
          reload,
        );
        return;
      }
      dispatch(
        statusChangeRequested({
          code: order.code,
          to: 'delivered',
          from: order.status,
          force: true,
        }),
      );
    },
    [dispatch, reload],
  );
  return (
    <Page>
      <Head>
        <h1>
          {t('address.deliveries')} · {t('address.deliveriesOpen', { count: open })}
        </h1>
        <Button variant="quiet" onClick={onBack}>
          {t('address.back')}
        </Button>
      </Head>
      {deliveries.length === 0 ? <Empty>{t('address.nothing')}</Empty> : null}
      <List>
        {deliveries.map((order) => (
          <DeliveryRow key={order.code} order={order} onDone={done} />
        ))}
      </List>
    </Page>
  );
}

export function DeliveriesScreen(props: Readonly<{ onBack: () => void }>) {
  return (
    <ScreenErrorBoundary>
      <DeliveriesContent {...props} />
    </ScreenErrorBoundary>
  );
}
