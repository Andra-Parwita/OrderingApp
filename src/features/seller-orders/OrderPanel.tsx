import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatOrderCode, parseOrderCode } from '../../../shared/orderCode';
import { Button, SlideOver } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { OrderDetailScreen } from './OrderDetailScreen';
import type { StatusFilter } from './orderStatus';
import { useVisibleOrders } from './ordersShared';
import { neighbourCodes } from './sellerOrdersSelectors';

export type OrderPanelProps = Readonly<{
  code: string;
  /** The table's filter and search: Previous and Next follow the same rows. */
  filter: StatusFilter;
  query: string;
  onClose: () => void;
  onOpenOrder: (code: string) => void;
}>;

/** The desktop slide-over: one order, with Previous / Next through the table's rows. */
export function OrderPanel({ code, filter, query, onClose, onOpenOrder }: OrderPanelProps) {
  const { t } = useTranslation(SELLER_NS);
  const visible = useVisibleOrders(filter, query);
  const raw = parseOrderCode(code) ?? code;
  const { previous, next } = neighbourCodes(visible, raw);

  const goPrevious = useCallback(() => {
    if (previous) onOpenOrder(previous);
  }, [onOpenOrder, previous]);
  const goNext = useCallback(() => {
    if (next) onOpenOrder(next);
  }, [onOpenOrder, next]);
  // Focus goes back to this order's row, even after Next moved on from the one that opened it.
  const returnFocus = useCallback(
    () => document.querySelector<HTMLElement>(`[data-row-id="${raw}"]`),
    [raw],
  );

  return (
    <SlideOver
      label={t('detail.panelLabel', { code: formatOrderCode(raw) })}
      closeLabel={t('detail.close')}
      onClose={onClose}
      returnFocus={returnFocus}
      headerStart={
        <>
          <Button disabled={!previous} onClick={goPrevious}>
            {t('detail.previous')}
          </Button>
          <Button disabled={!next} onClick={goNext}>
            {t('detail.next')}
          </Button>
        </>
      }
    >
      <OrderDetailScreen key={raw} code={raw} layout="panel" onBack={onClose} />
    </SlideOver>
  );
}
