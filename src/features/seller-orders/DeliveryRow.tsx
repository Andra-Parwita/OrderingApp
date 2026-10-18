import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { addressLine, checkOnMapUrl, directionsUrl } from '../../../shared/address';
import type { SellerOrder } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import { isIphone } from '../../components/isIphone';
import { PrivateTag } from '../../components/PrivateTag';
import { QuietMapLinks } from '../../components/QuietMapLinks';
import { Button, Menu } from '../../ui';
import { ContactLinks, useAddressActions } from './DeliveryAddressBlock';
import { SELLER_NS } from './i18n/register';
import { itemsSummary, useLang } from './orderText';

// Plan 104: one delivery as a row across the width. Line 1: who, code, items, actions. Line 2: the
// whole address and the note for the driver (never cut). Line 3 only when something needs it.

const Item = styled.li<{ $done: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  opacity: ${({ $done }) => ($done ? 0.6 : 1)};
`;
const Line1 = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
`;
const Who = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  code {
    font-family: ${({ theme }) => theme.font.mono};
    color: ${({ theme }) => theme.c.muted};
  }
  @media (min-width: 37.5rem) {
    flex: 0 1 16rem;
    flex-wrap: nowrap;
    min-width: 0;
    b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
`;
const Items = styled.span`
  flex: 1 1 100%;
  min-width: 0;
  color: ${({ theme }) => theme.c.muted};
  overflow-wrap: anywhere;
  @media (min-width: 37.5rem) {
    flex: 1 1 8rem;
  }
`;
const Acts = styled.span`
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  button,
  a {
    white-space: nowrap;
  }
  > span:first-child {
    flex: 1 1 100%;
    flex-wrap: nowrap;
  }
  @media (min-width: 37.5rem) {
    flex: none;
    flex-wrap: nowrap;
    margin-left: auto;
    justify-content: flex-end;
    > span:first-child {
      flex: none;
    }
  }
`;
const Line2 = styled.p`
  margin: 0;
  overflow-wrap: anywhere;
  .muted {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Line3 = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  strong {
    font-size: 0.875rem;
  }
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
const Done = styled.span`
  color: ${({ theme }) => theme.c.muted};
  white-space: nowrap;
`;

export function DeliveryRow({
  order,
  onDone,
}: Readonly<{ order: SellerOrder; onDone: (order: SellerOrder) => void }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const { readOnly, digits, remove, gotIt } = useAddressActions(order);
  const apple = isIphone();
  const found = order.address && 'address' in order.address ? order.address.address : null;
  const delivered = order.status === 'delivered';
  const time = order.private?.eventTime;
  const canDelete = !order.private && found !== null && !readOnly;
  const changed = !order.private && order.addressChanged === 'new';
  const line3 = changed || apple || digits !== undefined;
  return (
    <Item $done={delivered}>
      <Line1>
        <Who>
          <b>{order.firstName}</b>
          <code>{formatOrderCode(order.code)}</code>
          {order.private ? <PrivateTag label={t('private.tag')} /> : null}
          {time ? <code>{time}</code> : null}
        </Who>
        <Items>{itemsSummary(order, lang)}</Items>
        <Acts>
          {found ? (
            <QuietMapLinks
              directions={{ href: directionsUrl(found, apple), label: t('address.directions') }}
              map={{ href: checkOnMapUrl(found, apple), label: t('address.viewOnMap') }}
            />
          ) : null}
          {delivered ? (
            <Done>{t('address.deliveredDone')}</Done>
          ) : (
            <Button onClick={() => onDone(order)}>{t('address.delivered')} ✓</Button>
          )}
          {canDelete ? (
            <Menu
              label={t('address.more')}
              items={[{ label: t('address.deleteNow'), danger: true, onSelect: remove }]}
            />
          ) : null}
        </Acts>
      </Line1>
      <Line2>
        {found ? (
          <>
            <b>{addressLine(found)}</b>
            {found.notes ? (
              <span className="muted">
                {' · '}
                {t('address.notes')}: {found.notes}
              </span>
            ) : null}
            {found.lat !== undefined ? (
              <span className="muted">
                {' · '}
                {t('address.pinned')}
              </span>
            ) : null}
          </>
        ) : (
          <span className="muted">
            {order.address && 'unavailable' in order.address
              ? t('address.unavailable')
              : t('address.none')}
          </span>
        )}
      </Line2>
      {line3 ? (
        <Line3>
          {changed ? (
            <>
              <strong role="status">↻ {t('address.changedMark')}</strong>
              {readOnly ? null : (
                <Button variant="quiet" onClick={gotIt}>
                  {t('address.gotIt')} ✓
                </Button>
              )}
            </>
          ) : null}
          {found && apple ? (
            <a href={directionsUrl(found, true)} target="_blank" rel="noopener noreferrer">
              {t('address.appleMaps')}
            </a>
          ) : null}
          {digits ? <ContactLinks digits={digits} /> : null}
        </Line3>
      ) : null}
    </Item>
  );
}
