import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { isAddressComplete, type DeliveryAddress } from '../../../shared/address';
import type { Language, SellerOrder } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import { PrivateTag } from '../../components/PrivateTag';
import { Icon } from '../../ui';
import { SATURDAY_NS } from './i18n/register';
import { isClosed, itemsShort, money, Mono, OrderRowRoot, StatusMark, totalCents } from './parts';

// Plan 081: a private (Khusus) order inside Pickup & delivery. Team-only: the address comes with the
// private list. Deliveries use the delivery row; a pickup gets Collected.

const Top = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const OpenLink = styled.button`
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
`;
const Right = styled.span`
  grid-column: 2;
  grid-row: 1;
  font-weight: 600;
`;
const Sub = styled.span`
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: 0.875rem;
`;
const Actions = styled.div`
  grid-column: 1 / -1;
  display: flex;
  margin-top: ${({ theme }) => theme.spacing.sm};
`;
// The step-button look (as in the delivery steps), so Collected never reads as a link.
const CollectedButton = styled.button`
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;

/** The readable address of a private order, or null (none, or the kitchen cannot read it). */
export function privateAddress(order: SellerOrder): DeliveryAddress | null {
  const held = order.address;
  if (!held || !('address' in held)) return null;
  return isAddressComplete(held.address) ? held.address : null;
}

type Props = Readonly<{
  order: SellerOrder;
  lang: Language;
  busy?: boolean;
  /** Open `/seller/private/<code>`. */
  onOpen?: (code: string) => void;
  /** Mark it Collected. */
  onMark: (order: SellerOrder) => void;
}>;

/** A private pickup in Pickup & delivery (private deliveries use the delivery row). */
export function PrivateRow({ order, lang, busy = false, onOpen, onMark }: Props) {
  const { t } = useTranslation(SATURDAY_NS);
  const code = formatOrderCode(order.code);
  const closed = isClosed(order.status);
  const time = order.private?.eventTime;
  return (
    <OrderRowRoot $dim={closed} aria-label={t('pickup.rowLabel', { code, name: order.firstName })}>
      <Top>
        {time ? <b>{time}</b> : null}
        {onOpen ? (
          <OpenLink
            type="button"
            aria-label={t('private.open', { name: order.firstName })}
            onClick={() => onOpen(order.code)}
          >
            {order.firstName}
          </OpenLink>
        ) : (
          <b>{order.firstName}</b>
        )}
        <Mono>{code}</Mono>
        <PrivateTag label={t('private.tag')} />
      </Top>
      <Right>{money(totalCents(order), lang)}</Right>
      <Sub>
        <span>{itemsShort(order.lines, lang)}</span>
        <StatusMark status={order.status} />
      </Sub>
      {closed ? null : (
        <Actions>
          <CollectedButton type="button" disabled={busy} onClick={() => onMark(order)}>
            <Icon name="check" />
            {t('private.collected')}
          </CollectedButton>
        </Actions>
      )}
    </OrderRowRoot>
  );
}
