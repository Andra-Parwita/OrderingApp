import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { OrderDayTag } from '../../components/dayChips/OrderDayTag';
import { Icon, type IconName } from '../../ui';
import { ConfirmedPill } from './ConfirmedMark';
import { RepeatTag } from './RepeatNote';
import { SELLER_NS } from './i18n/register';
import { NewTag } from './orderRowCells';

import { StatusMark } from './StatusMark';
import { customerKind } from './customerKind';
import { itemsSummary, orderTotalCents, useLang } from './orderText';

// One order in the live list (handoff, Home): code, first name, Changed flag, small icons, total,
// items, pickup or delivery, status, Paid. The whole row is one button. Plan 108: on a wide list
// (no order open) it is one line and shows the customer's note; otherwise two lines.
//
// Plan 126: every row is a subgrid of RowsGrid, so the fulfilment label, the day tag, the status and
// the price share one set of column tracks and line up at any text size (a track is as wide as its
// widest cell, nothing has a fixed width). With no day tag in the list the tag track is left out.
// Wide (no order open, 70 rem and up): one line [code name flags | items | note | how | tag | status |
// price]. Otherwise two lines: the code line and, above the status, the price; then how, tag, items and
// status, with the second line starting at the same x as the first.

const WIDE = '70rem';

const tracks = (wide: boolean, daySlot: boolean): string => {
  const tag = daySlot ? '[how-end tag-start] max-content [tag-end' : '[how-end';
  return wide
    ? `[line-start] minmax(0, 15rem) [line-end items-start] minmax(0, 1fr) [items-end note-start] minmax(0, 1fr) [note-end how-start] max-content ${tag} status-start] max-content [status-end total-start] max-content [total-end]`
    : `[line-start how-start] max-content ${tag} items-start] minmax(0, 1fr) [items-end status-start total-start] max-content [status-end total-end]`;
};

/** The list's rows. `$wide`: no order is open beside the list. */
export const RowsGrid = styled.div<{ $wide: boolean; $daySlot: boolean }>`
  display: grid;
  column-gap: ${({ theme }) => theme.spacing.sm};
  grid-template-columns: ${({ $daySlot }) => tracks(false, $daySlot)};

  ${({ $wide, $daySlot, theme }) =>
    $wide
      ? `@media (min-width: ${WIDE}) { column-gap: ${theme.spacing.md}; grid-template-columns: ${tracks(true, $daySlot)}; }`
      : ''}
`;

const Row = styled.button<{ $selected: boolean; $fresh: boolean; $wide: boolean }>`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  row-gap: 0.125rem;
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
      ? `@media (min-width: ${WIDE}) { row-gap: 0; min-height: ${String(theme.size.tap + 4)}px; }`
      : ''}
`;

/** On a wide list every cell is on the one line. */
const wideRow = (wide: boolean): string =>
  wide ? `@media (min-width: ${WIDE}) { grid-row: 1; }` : '';

const Line = styled.div<{ $wide: boolean }>`
  grid-column: line-start / items-end;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;

  ${({ $wide }) =>
    $wide ? `@media (min-width: ${WIDE}) { grid-column: line-start / line-end; }` : ''}
`;
const NoteCell = styled.span`
  display: none;
  grid-column: note-start / note-end;
  grid-row: 1;
  overflow: hidden;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  font-style: italic;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (min-width: ${WIDE}) {
    display: block;
  }
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
const Items = styled.span<{ $wide: boolean }>`
  grid-column: items-start / items-end;
  grid-row: 2;
  overflow: hidden;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;

  ${({ $wide }) => wideRow($wide)}
`;
const Total = styled.span`
  grid-column: total-start / total-end;
  grid-row: 1;
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  justify-self: end;
`;
const How = styled.span<{ $wide: boolean }>`
  grid-column: how-start / how-end;
  grid-row: 2;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
  white-space: nowrap;

  svg {
    width: 0.9375rem;
    height: 0.9375rem;
  }
  ${({ $wide }) => wideRow($wide)}
`;
const TagCell = styled.span<{ $wide: boolean }>`
  grid-column: tag-start / tag-end;
  grid-row: 2;
  display: inline-flex;
  ${({ $wide }) => wideRow($wide)}
`;
const StatusCell = styled.span<{ $wide: boolean }>`
  grid-column: status-start / status-end;
  grid-row: 2;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
  white-space: nowrap;
  ${({ $wide }) => wideRow($wide)}
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
  /** Plan 126: some order in the list has a delivery day, so the list has a day tag track. */
  daySlot?: boolean;
  onOpen: (code: string) => void;
}>;

export const LiveOrderRow = memo(function LiveOrderRow({
  order,
  selected,
  isNew = false,
  panelOpen = false,
  daySlot = false,
  onOpen,
}: LiveOrderRowProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const open = useCallback(() => onOpen(order.code), [onOpen, order.code]);
  const kind = customerKind(order);
  const wide = !panelOpen;
  const hasTag = order.fulfilment === 'delivery' && order.handoverDate !== undefined;
  return (
    <Row
      type="button"
      $selected={selected}
      $fresh={isNew}
      $wide={wide}
      aria-current={selected ? 'true' : undefined}
      data-row-id={order.code}
      onClick={open}
    >
      <Line $wide={wide}>
        <Code>{formatOrderCode(order.code)}</Code>
        <Name>{order.firstName}</Name>
        <ConfirmedPill order={order} />
        {isNew ? <NewTag /> : null}
        <RepeatTag code={order.code} />
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
      <Items $wide={wide}>{itemsSummary(order, lang)}</Items>
      {wide && order.note ? <NoteCell title={order.note}>{order.note}</NoteCell> : null}
      <How $wide={wide}>
        <Icon name={order.fulfilment === 'delivery' ? 'truck' : 'bag'} />
        {t(`fulfilment.${order.fulfilment}`)}
      </How>
      {daySlot && hasTag ? (
        <TagCell $wide={wide}>
          <OrderDayTag order={order} lang={lang} />
        </TagCell>
      ) : null}
      <StatusCell $wide={wide}>
        <StatusMark status={order.status} />
        {order.paid ? (
          <Paid>
            <Icon name="check" />
            {t('live.paid')}
          </Paid>
        ) : null}
      </StatusCell>
    </Row>
  );
});
