import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { BottomSheet, Button } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { SavingSpinner } from './SavingSpinner';
import { orderTotalCents, useLang } from './orderText';
import { selectPending } from './sellerOrdersSelectors';
import { paidChangeRequested } from './sellerOrdersSlice';

// Plan 103 fix 7: Paid / Not paid is money, so it asks first. A bottom sheet on tablet and phone
// with the order's code, name and total; the change shows at once after "Mark paid" (the
// optimistic update) and the sheet shows Saving… until the server has answered.

const Summary = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
  font-variant-numeric: tabular-nums;

  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.875rem;
    color: ${({ theme }) => theme.c.muted};
  }
  strong {
    font-size: 1.125rem;
  }
`;
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Go = styled(Button)<{ $danger: boolean }>`
  white-space: nowrap;

  ${({ $danger, theme }) =>
    $danger
      ? `border-color: ${theme.c.danger}; background: transparent; color: ${theme.c.danger};`
      : ''}
`;

export type PaidSheetProps = Readonly<{
  order: Order;
  /** What the sheet will set: true = "Mark paid", false = "Mark not paid". */
  paid: boolean;
  onClose: () => void;
}>;

export function PaidSheet({ order, paid, onClose }: PaidSheetProps) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const pending = useSelector(selectPending);
  const [asked, setAsked] = useState(false);
  const saving = asked && order.code in pending;
  // Confirmed and answered (saved, or put back after a failure): the sheet is done.
  useEffect(() => {
    if (asked && !(order.code in pending)) onClose();
  }, [asked, order.code, pending, onClose]);
  const confirm = () => {
    setAsked(true);
    dispatch(paidChangeRequested({ code: order.code, paid }));
  };
  const label = paid ? t('paidSheet.markPaid') : t('paidSheet.markNotPaid');
  return (
    <BottomSheet
      title={paid ? t('paidSheet.titlePaid') : t('paidSheet.titleUnpaid')}
      onClose={saving ? () => undefined : onClose}
    >
      <Summary>
        <code>{formatOrderCode(order.code)}</code>
        <span>{order.firstName}</span>
        <strong>
          {t('paidSheet.total')} {formatMoney(orderTotalCents(order), lang)}
        </strong>
      </Summary>
      <Actions>
        <Go
          variant={paid ? 'primary' : 'secondary'}
          $danger={!paid}
          fullWidth
          disabled={saving}
          onClick={confirm}
        >
          {saving ? (
            <>
              <SavingSpinner />
              {t('paidSheet.saving')}
            </>
          ) : (
            label
          )}
        </Go>
        <Button variant="quiet" fullWidth disabled={saving} onClick={onClose}>
          {t('paidSheet.cancel')}
        </Button>
      </Actions>
    </BottomSheet>
  );
}
