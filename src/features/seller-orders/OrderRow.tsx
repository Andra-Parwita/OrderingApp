import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { ListRow, Pill } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { KIND_MARK, customerKind } from './customerKind';
import { toneOf } from './orderStatus';
import { actorLabel, itemsSummary, orderTotalCents, useLang } from './orderText';

const Code = styled.span`
  white-space: nowrap;
  margin-right: ${({ theme }) => theme.spacing.sm};
`;
const Mark = styled.span`
  margin-left: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.regular};
  color: ${({ theme }) => theme.colour.textMuted};
  white-space: nowrap;
`;
const Total = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
  white-space: nowrap;
`;

export type OrderRowProps = Readonly<{ order: Order; onOpen: (code: string) => void }>;

export const OrderRow = memo(function OrderRow({ order, onOpen }: OrderRowProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const open = useCallback(() => onOpen(order.code), [onOpen, order.code]);

  const kind = customerKind(order);
  const primary = (
    <>
      <Code>{formatOrderCode(order.code)}</Code>
      {order.firstName}
      {order.paid ? <Mark>{t('orders.paid')}</Mark> : null}
    </>
  );
  const secondary = (
    <>
      {itemsSummary(order, lang)} · {t(`fulfilment.${order.fulfilment}`)}
      {order.changed ? <Mark>{t('orders.changed')}</Mark> : null}
      {kind ? <Mark>{t(KIND_MARK[kind])}</Mark> : null}
      {order.locked ? <Mark>{t('orders.locked')}</Mark> : null}
      {order.note ? <Mark>{t('orders.note')}</Mark> : null}
      {order.enteredBy ? (
        <Mark>{t('orders.enteredBy', { name: actorLabel(order.enteredBy, t) })}</Mark>
      ) : null}
    </>
  );
  const trailing = (
    <>
      <Pill tone={toneOf(order.status)}>{t(`status.${order.status}`)}</Pill>
      <Total>{formatMoney(orderTotalCents(order), lang)}</Total>
    </>
  );
  return <ListRow primary={primary} secondary={secondary} trailing={trailing} onClick={open} />;
});
