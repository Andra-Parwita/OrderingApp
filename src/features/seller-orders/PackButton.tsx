import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { deliveryDayOf, formatDayList } from '../../../shared/deliveryDays';
import { Button, Icon } from '../../ui';
import { PackSheet, canPack, nextToPack, packProgress } from '../../components/pack';
import { SELLER_NS } from './i18n/register';
import { useReadOnlyOrders } from './orderAccess';
import { useLang } from './orderText';
import {
  selectCookingDate,
  selectCurrent,
  selectOrderByCode,
  selectOrders,
} from './sellerOrdersSelectors';
import type { SellerOrdersRootState } from './sellerOrdersSlice';

// Plan 132: "Pack · N of M" in the order's pinned footer, and the pack sheet it opens. "Ready & next
// order" opens the sheet of the next order still to pack (by pickup time) in the same menu.

/** The footer slot: the whole width of the row, so the other buttons wrap below it. */
const Slot = styled.div`
  flex: 1 1 100%;
  min-width: 0;
`;

/** Whether the person may pack this order from here (the server lets the owner and a chef pack, not a helper). */
export function useMayPack(order: Order): boolean {
  const readOnly = useReadOnlyOrders();
  return !readOnly && canPack(order);
}

export function PackButton({
  order,
  primary = true,
}: Readonly<{ order: Order; primary?: boolean }>) {
  const { t } = useTranslation(SELLER_NS);
  const may = useMayPack(order);
  const orders = useSelector(selectOrders);
  const current = useSelector(selectCurrent);
  const cookingDate = useSelector(selectCookingDate);
  const lang = useLang();
  const [openCode, setOpenCode] = useState<string | null>(null);
  const open = useSelector((state: SellerOrdersRootState) =>
    openCode ? selectOrderByCode(state, openCode) : undefined,
  );
  const points = useMemo(
    () => (current.status === 'ready' ? current.view.pickupPoints : []),
    [current],
  );
  const close = useCallback(() => setOpenCode(null), []);
  const next = useCallback(() => {
    const following = openCode ? nextToPack(orders, points, openCode) : null;
    setOpenCode(following ? following.code : null);
  }, [openCode, orders, points]);
  if (!may) return null;

  const { ticked, total, packed } = packProgress(order);
  const place =
    open?.fulfilment === 'pickup'
      ? (points.find((point) => point.id === open.pickupPlaceId) ?? points[0])
      : undefined;
  const time = open ? (open.private?.eventTime ?? place?.window.start) : undefined;
  const where = open
    ? [
        t(`fulfilment.${open.fulfilment}`),
        ...(place ? [place.place] : []),
        ...(open.fulfilment === 'delivery' && cookingDate
          ? [formatDayList([deliveryDayOf(open, cookingDate)], lang)]
          : []),
        ...(time ? [time] : []),
      ].join(' · ')
    : '';
  return (
    <Slot>
      <Button
        variant={primary ? 'primary' : 'secondary'}
        fullWidth
        onClick={() => setOpenCode(order.code)}
      >
        <Icon name="bag" />
        {packed ? t('pack.buttonPacked') : t('pack.button', { ticked, total })}
      </Button>
      {open ? (
        <PackSheet key={open.code} order={open} where={where} onClose={close} onNext={next} />
      ) : null}
    </Slot>
  );
}
