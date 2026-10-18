import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { Icon, type IconName } from '../../ui';
import { ConfirmedPill } from './ConfirmedMark';
import { SELLER_NS } from './i18n/register';
import { NewTag } from './orderRowCells';
import { StatusMark } from './StatusMark';
import { customerKind } from './customerKind';
import { itemsSummary, orderTotalCents, useLang } from './orderText';

// One order in the live list (handoff, Home): code, first name, Changed flag, small icons, total,
// items, pickup or delivery, status, Paid. The whole row is one button. Plan 108: on a wide list
// (no order open) it is one line and shows the customer's note; otherwise two lines.

const Row = styled.button<{ $selected: boolean; $fresh: boolean; $wide: boolean }>`
  display: grid;
  grid-template-areas: 'line total' 'items right';
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.125rem ${({ theme }) => theme.spacing.lg};
  align-items: center;
  width: 100%;
  min-height: ${({ theme }) => theme.size.rowOrder + 8}px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadTablet}px;
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme, $selected, $fresh }) =>
    $selected || $fresh ? theme.c.tint : 'transparent'};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color 1s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: ${({ theme, $selected }) => ($selected ? theme.c.tint : theme.c.surf2)};
  }

  ${({ $wide, theme }) =>
    $wide
      ? `@media (min-width: 70rem) {
    grid-template-areas: 'line items note right total';
    grid-template-columns: minmax(0, 15rem) minmax(0, 1fr) minmax(0, 1fr) 14rem 4.5rem;
    gap: 0 ${theme.spacing.md};
    min-height: ${theme.size.tap + 4}px;
  }`
      : ''}
`;
const Line = styled.div`
  grid-area: line;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;
const NoteCell = styled.span`
  display: none;
  grid-area: note;
  overflow: hidden;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  font-style: italic;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (min-width: 70rem) {
    display: block;
  }
`;
const RightLine = styled(Line)`
  grid-area: right;
  justify-content: flex-end;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const Code = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-weight: 600;
  font-size: 0.8125rem;
  color: ${({ theme }) => theme.c.muted};
  white-space: nowrap;
`;
const Name = styled.span`
  overflow: hidden;
  font-size: 0.9375rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const Flag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;

  svg {
    width: 0.9375rem;
    height: 0.9375rem;
  }
`;
const Small = styled.span`
  display: inline-flex;
  color: ${({ theme }) => theme.c.muted};

  svg {
    width: 0.9375rem;
    height: 0.9375rem;
  }
`;
const Items = styled.span`
  grid-area: items;
  overflow: hidden;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const Total = styled.span`
  grid-area: total;
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: end;
`;
const How = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  white-space: nowrap;

  svg {
    width: 0.9375rem;
    height: 0.9375rem;
  }
`;
const Paid = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.conf};
  font-weight: 600;
  white-space: nowrap;

  svg {
    width: 0.9375rem;
    height: 0.9375rem;
  }
`;

function SmallIcon({ icon, label }: Readonly<{ icon: IconName; label: string }>) {
  return (
    <Small role="img" aria-label={label} title={label}>
      <Icon name={icon} />
    </Small>
  );
}

export type LiveOrderRowProps = Readonly<{
  order: Order;
  selected: boolean;
  /** Plan 021: a new customer order, highlighted for a few seconds. */
  isNew?: boolean;
  /** An order is open beside the list: the row has no room for the note. */
  panelOpen?: boolean;
  onOpen: (code: string) => void;
}>;

export const LiveOrderRow = memo(function LiveOrderRow({
  order,
  selected,
  isNew = false,
  panelOpen = false,
  onOpen,
}: LiveOrderRowProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const open = useCallback(() => onOpen(order.code), [onOpen, order.code]);
  const kind = customerKind(order);
  return (
    <Row
      type="button"
      $selected={selected}
      $fresh={isNew}
      $wide={!panelOpen}
      aria-current={selected ? 'true' : undefined}
      data-row-id={order.code}
      onClick={open}
    >
      <Line>
        <Code>{formatOrderCode(order.code)}</Code>
        <Name>{order.firstName}</Name>
        <ConfirmedPill order={order} />
        {isNew ? <NewTag /> : null}
        {order.changed || order.addressChanged === 'new' ? (
          <Flag>
            <Icon name="pencil" />
            {order.addressChanged === 'new' ? t('live.addressChanged') : t('live.changed')}
          </Flag>
        ) : null}
        {order.note ? <SmallIcon icon="note" label={t('live.note')} /> : null}
        {order.waReceived || kind === 'waReceived' ? (
          <SmallIcon icon="chat" label={t('live.wa')} />
        ) : null}
        {order.returning ? <SmallIcon icon="person" label={t('live.returning')} /> : null}
        {order.enteredBy ? <SmallIcon icon="person" label={t('live.staff')} /> : null}
        {order.locked ? <SmallIcon icon="lock" label={t('live.locked')} /> : null}
      </Line>
      <Total>{formatMoney(orderTotalCents(order), lang)}</Total>
      <Items>{itemsSummary(order, lang)}</Items>
      {!panelOpen && order.note ? <NoteCell title={order.note}>{order.note}</NoteCell> : null}
      <RightLine>
        <How>
          <Icon name={order.fulfilment === 'delivery' ? 'truck' : 'bag'} />
          {t(`fulfilment.${order.fulfilment}`)}
        </How>
        <StatusMark status={order.status} />
        {order.paid ? (
          <Paid>
            <Icon name="check" />
            {t('live.paid')}
          </Paid>
        ) : null}
      </RightLine>
    </Row>
  );
});
