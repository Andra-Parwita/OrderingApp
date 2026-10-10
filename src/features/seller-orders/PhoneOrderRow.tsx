import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Icon } from '../../ui';
import { getContactDigits } from './contacts';
import { SELLER_NS } from './i18n/register';
import { StatusMark } from './StatusMark';
import { itemsSummary, orderTotalCents, useLang } from './orderText';
import { openOrderLink } from './whatsappLink';

// One order in the phone list (handoff, Home, phone): name, code, total, items, status, Changed,
// pickup or delivery, Paid, and a round WhatsApp button. The row opens the order; the button opens
// WhatsApp with the message written, to the saved number if this phone has one (D-059).

const Row = styled.div<{ $fresh: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme, $fresh }) => ($fresh ? theme.c.tint : 'transparent')};
  transition: background-color 1s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
// Plan 021: the highlight is never colour alone; this word goes with it.
const NewTag = styled.span`
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.atext};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  color: ${({ theme }) => theme.c.atext};
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
`;
const Open = styled.button`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  min-height: ${({ theme }) => theme.size.rowOrder + 8}px;
  padding: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.size.pagePadPhone}px;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: start;
  cursor: pointer;
`;
const Top = styled.span`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;
const Name = styled.span`
  overflow: hidden;
  font-size: 1rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const Code = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.8125rem;
  color: ${({ theme }) => theme.c.muted};
`;
const Total = styled.span`
  margin-inline-start: auto;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;
const Items = styled.span`
  overflow: hidden;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const Marks = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  font-size: 0.875rem;

  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const Mark = styled.span<{ $tone: 'warn' | 'conf' | 'muted' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme, $tone }) => theme.c[$tone]};
  font-weight: ${({ $tone }) => ($tone === 'muted' ? 400 : 600)};
`;
const Send = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  margin-inline-end: ${({ theme }) => theme.size.pagePadPhone}px;
  border: 0;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
  cursor: pointer;

  svg {
    width: 1.375rem;
    height: 1.375rem;
  }
`;

export type PhoneOrderRowProps = Readonly<{
  order: Order;
  /** Plan 021: a new customer order, highlighted for a few seconds. */
  isNew?: boolean;
  onOpen: (code: string) => void;
}>;

export const PhoneOrderRow = memo(function PhoneOrderRow({
  order,
  isNew = false,
  onOpen,
}: PhoneOrderRowProps) {
  const { t, i18n } = useTranslation(SELLER_NS);
  const lang = useLang();
  const open = useCallback(() => onOpen(order.code), [onOpen, order.code]);
  const send = useCallback(
    () => openOrderLink(i18n, order, getContactDigits(currentSellerSlug(), order.code)),
    [i18n, order],
  );
  return (
    <Row data-row-id={order.code} $fresh={isNew}>
      <Open type="button" onClick={open}>
        <Top>
          <Name>{order.firstName}</Name>
          {isNew ? <NewTag>{t('live.new')}</NewTag> : null}
          <Code>{formatOrderCode(order.code)}</Code>
          <Total>{formatMoney(orderTotalCents(order), lang)}</Total>
        </Top>
        <Items>{itemsSummary(order, lang)}</Items>
        <Marks>
          <StatusMark status={order.status} />
          {order.changed ? (
            <Mark $tone="warn">
              <Icon name="pencil" />
              {t('live.changed')}
            </Mark>
          ) : null}
          <Mark $tone="muted">
            <Icon name={order.fulfilment === 'delivery' ? 'truck' : 'bag'} />
            {t(`fulfilment.${order.fulfilment}`)}
          </Mark>
          {order.paid ? (
            <Mark $tone="conf">
              <Icon name="check" />
              {t('live.paid')}
            </Mark>
          ) : null}
        </Marks>
      </Open>
      <Send type="button" aria-label={t('phone.sendOn', { name: order.firstName })} onClick={send}>
        <Icon name="chat" />
      </Send>
    </Row>
  );
});
