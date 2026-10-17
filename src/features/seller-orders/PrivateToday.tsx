import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { styled } from 'styled-components';
import {
  addressLine,
  checkOnMapUrl,
  directionsUrl,
  type DeliveryAddress,
} from '../../../shared/address';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { PrivateTag } from '../../components/PrivateTag';
import { isIphone } from '../../components/isIphone';
import { StatusMark } from './StatusMark';
import { SELLER_NS } from './i18n/register';
import { itemsSummary, orderTotalCents, useLang } from './orderText';
import { usePrivateToday } from './usePrivateToday';

// Plan 081: "Private today", a short list above the menu's orders. Not in the menu counts or stats.

const Section = styled.section`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Heading = styled.h2`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  font-size: 1rem;
`;
const Item = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.text};
  text-decoration: none;
`;
const Line = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Muted = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;

const LinkRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};

  a {
    display: inline-flex;
    align-items: center;
    min-height: ${({ theme }) => theme.size.tap}px;
    padding: 0 ${({ theme }) => theme.spacing.md};
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
    border-radius: ${({ theme }) => theme.size.radiusControl}px;
    color: ${({ theme }) => theme.c.text};
    font-size: 0.9375rem;
    font-weight: 600;
    text-decoration: none;
  }
`;
const Total = styled.span`
  margin-left: auto;
  font-weight: 600;
`;

export function PrivateToday() {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const { orders } = usePrivateToday();
  if (orders.length === 0) return null;
  const sorted = [...orders].sort((a, b) =>
    (a.private?.eventTime ?? '99:99').localeCompare(b.private?.eventTime ?? '99:99'),
  );
  return (
    <Section aria-label={t('private.today')}>
      <Heading>{t('private.today')}</Heading>
      {sorted.map((order) => (
        <Item key={order.id} to={`/seller/private/${order.code}`}>
          <Line>
            <b>{order.private?.eventTime ?? '–'}</b>
            <b>{order.firstName}</b>
            <Muted>{formatOrderCode(order.code)}</Muted>
            <PrivateTag label={t('private.tag')} />
            <StatusMark status={order.status} />
            <Total>{formatMoney(orderTotalCents(order), lang)}</Total>
          </Line>
          <Muted>
            {itemsSummary(order, lang)} · {t(`fulfilment.${order.fulfilment}`)}
          </Muted>
        </Item>
      ))}
    </Section>
  );
}

/** A private delivery in the Deliveries list: its address with View on map and Directions. */
export function PrivateDeliveryAddress({ address }: Readonly<{ address: DeliveryAddress }>) {
  const { t } = useTranslation(SELLER_NS);
  const apple = isIphone();
  return (
    <>
      <p>
        <b>{addressLine(address)}</b>
      </p>
      {address.notes ? (
        <p>
          {t('address.notes')}: {address.notes}
        </p>
      ) : null}
      <LinkRow>
        <a href={checkOnMapUrl(address, apple)} target="_blank" rel="noopener noreferrer">
          {t('private.viewOnMap')}
        </a>
        <a href={directionsUrl(address, apple)} target="_blank" rel="noopener noreferrer">
          {t('address.directions')}
        </a>
      </LinkRow>
    </>
  );
}
