import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { deliveryDayOf, formatDayList } from '../../../shared/deliveryDays';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { Icon } from '../../ui';
import { PaidTag, packProgress } from '../../components/pack';
import { SELLER_NS } from './i18n/register';
import { orderTotalCents, useLang } from './orderText';
import { selectCookingDate, selectCurrent } from './sellerOrdersSelectors';
import { StatusMark } from './StatusMark';

// Plan 132: the order's pinned top (phone page and tablet panel): code, name, the big total with Paid
// or Not paid, status · pickup or delivery · place and time, and how much is packed. It stays while
// the rest scrolls.

const NBSP = String.fromCharCode(160);

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: 0;
`;
const Top = styled.div<{ $pinned: boolean }>`
  display: flex;
  align-items: center;
  flex-wrap: ${({ $pinned }) => ($pinned ? 'nowrap' : 'wrap')};
  justify-content: space-between;
  gap: 0 ${({ theme }) => theme.spacing.md};
`;
const Title = styled.h2<{ $pinned: boolean }>`
  display: flex;
  flex: 1 1 8rem;
  flex-direction: ${({ $pinned }) => ($pinned ? 'column' : 'row')};
  flex-wrap: ${({ $pinned }) => ($pinned ? 'nowrap' : 'wrap')};
  align-items: baseline;
  gap: 0 ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;

  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.9375rem;
    font-weight: 600;
    color: ${({ theme }) => theme.c.muted};
    white-space: nowrap;
  }
  span {
    flex: 1 1 9rem;
    min-width: 0;
    overflow-wrap: break-word;
  }
  ${({ $pinned }) =>
    $pinned
      ? `font-size: 1.25rem; line-height: 1.2; span { flex: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`
      : ''}
`;
const Right = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;
// Tablet panel: Paid sits under the total so the pinned top stays one short row at larger text.
const TotalStack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  line-height: 1.2;

  strong {
    font-size: 1.25rem;
  }
`;
const Total = styled.strong`
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
`;
const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  cursor: pointer;
`;
const Sub = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const SubText = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: 0 ${({ theme }) => theme.spacing.md};
  min-width: 0;
`;
const SubItem = styled.span`
  min-width: 0;
`;
const Progress = styled.div<{ $inline?: boolean }>`
  ${({ $inline }) => ($inline ? 'flex: 1 1 10rem;' : '')}
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;
const Bar = styled.span`
  display: block;
  height: 0.25rem;
  overflow: hidden;
  border-radius: 0.125rem;
  background: ${({ theme }) => theme.c.line};

  i {
    display: block;
    height: 100%;
    background: ${({ theme }) => theme.c.fill};
  }
`;

export function OrderPinnedHead({
  order,
  onClose,
  part = 'all',
}: Readonly<{
  order: Order;
  onClose?: (() => void) | undefined;
  /** The tablet panel pins only the 'top' (with Paid beside the total); 'rest' scrolls with the items. */
  part?: 'all' | 'top' | 'rest';
}>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const current = useSelector(selectCurrent);
  const cookingDate = useSelector(selectCookingDate);
  const points = current.status === 'ready' ? current.view.pickupPoints : [];
  const place =
    order.fulfilment === 'pickup'
      ? (points.find((point) => point.id === order.pickupPlaceId) ?? points[0])
      : undefined;
  const time = order.private?.eventTime ?? place?.window.start;
  const { ticked, total, packed } = packProgress(order);
  const showProgress = total > 0 && order.status !== 'cancelled';
  const percent = packed || total === 0 ? 100 : Math.round((ticked / total) * 100);
  const where = [
    t(`fulfilment.${order.fulfilment}`),
    ...(place ? [place.place] : []),
    ...(order.fulfilment === 'delivery' && cookingDate
      ? [formatDayList([deliveryDayOf(order, cookingDate)], lang)]
      : []),
    ...(time ? [time] : []),
  ].join(`${NBSP}·${NBSP}`);
  const split = part !== 'all';
  const paid = <PaidTag paid={order.paid} pill />;
  const head = (
    <>
      <Top $pinned={part === 'top'}>
        <Title $pinned={part === 'top'}>
          <code>{formatOrderCode(order.code)}</code>
          <span>{order.firstName}</span>
        </Title>
        <Right>
          {part === 'top' ? (
            <TotalStack>
              <Total>{formatMoney(orderTotalCents(order), lang)}</Total>
              {paid}
            </TotalStack>
          ) : (
            <Total>{formatMoney(orderTotalCents(order), lang)}</Total>
          )}
          {onClose ? (
            <CloseButton type="button" aria-label={t('detail.close')} onClick={onClose}>
              <Icon name="x" />
            </CloseButton>
          ) : null}
        </Right>
      </Top>
    </>
  );
  const progress = showProgress ? (
    <Progress $inline={split}>
      <span>{packed ? t('pack.packed') : t('pack.progress', { ticked, total })}</span>
      <Bar aria-hidden="true">
        <i style={{ width: `${percent}%` }} />
      </Bar>
    </Progress>
  ) : null;
  // Tablet panel: status and packed bar share a line, the place and time sit under it.
  const rest = split ? (
    <>
      <Sub>
        <StatusMark status={order.status} />
        {progress}
      </Sub>
      <Sub>{where}</Sub>
    </>
  ) : (
    <>
      <Sub>
        <SubText>
          <SubItem>
            <StatusMark status={order.status} />
          </SubItem>
          <SubItem>{where}</SubItem>
        </SubText>
        {paid}
      </Sub>
      {progress}
    </>
  );
  return (
    <Root>
      {part === 'rest' ? null : head}
      {part === 'top' ? null : rest}
    </Root>
  );
}
