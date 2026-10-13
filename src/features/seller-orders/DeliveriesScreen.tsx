import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { formatOrderCode } from '../../../shared/orderCode';
import { Button } from '../../ui';
import { DeliveryAddressBlock } from './DeliveryAddressBlock';
import { SELLER_NS } from './i18n/register';
import { itemsSummary, useLang } from './orderText';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import { selectOrders } from './sellerOrdersSelectors';
import { pollingStarted, pollingStopped, statusChangeRequested } from './sellerOrdersSlice';

// Plan 071 stage 3: the cooking day's deliveries in one list: who, where (Directions), what, and a
// Delivered tick. Team-only; the addresses come with the orders from the server.

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 100dvh;
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
const Item = styled.li<{ $done: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  opacity: ${({ $done }) => ($done ? 0.6 : 1)};
  header {
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: baseline;
  }
  code {
    font-family: ${({ theme }) => theme.font.mono};
    color: ${({ theme }) => theme.c.muted};
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
  }
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.c.muted};
`;

function DeliveriesContent({ onBack }: Readonly<{ onBack: () => void }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const orders = useSelector(selectOrders);
  useEffect(() => {
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);
  const deliveries = orders
    .filter((order) => order.fulfilment === 'delivery' && order.status !== 'cancelled')
    .sort(
      (a, b) =>
        Number(a.status === 'delivered') - Number(b.status === 'delivered') ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const open = deliveries.filter((order) => order.status !== 'delivered').length;
  const done = useCallback(
    (code: string, from: (typeof orders)[number]['status']) =>
      dispatch(statusChangeRequested({ code, to: 'delivered', from, force: true })),
    [dispatch],
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
          <Item key={order.code} $done={order.status === 'delivered'}>
            <header>
              <b>{order.firstName}</b>
              <code>{formatOrderCode(order.code)}</code>
            </header>
            <p>{itemsSummary(order, lang)}</p>
            <DeliveryAddressBlock order={order} showEmpty />
            {order.status === 'delivered' ? (
              <p>{t('address.deliveredDone')}</p>
            ) : (
              <div>
                <Button onClick={() => done(order.code, order.status)}>
                  {t('address.delivered')} ✓
                </Button>
              </div>
            )}
          </Item>
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
