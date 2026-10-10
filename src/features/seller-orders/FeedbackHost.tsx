import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { Toast, UndoToast, WarningDialog } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { selectNotice, selectToast, selectWarned } from './sellerOrdersSelectors';
import {
  noticeCleared,
  paidChangeRequested,
  statusChangeRequested,
  toastCleared,
  warningConfirmed,
  warningDismissed,
} from './sellerOrdersSlice';

/**
 * The seller's feedback for quick actions, mounted once per orders screen: a toast with Undo
 * (confirm, paid, cancel), a plain toast (collected, nudge), and the warning dialog that opens
 * when the server answers 409 with a warning (D-062; "Continue anyway" sends the call again with
 * force).
 */
export function FeedbackHost() {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useSelector(selectToast);
  const warned = useSelector(selectWarned);
  const notice = useSelector(selectNotice);

  const clear = useCallback(() => {
    dispatch(toastCleared());
    dispatch(noticeCleared());
  }, [dispatch]);
  const undo = useCallback(() => {
    // Plan 021: a new-order toast's button opens the order, or shows the list.
    if (toast?.open) {
      dispatch(toastCleared());
      void navigate(toast.open.code ? `/seller/orders/${toast.open.code}` : '/seller');
      return;
    }
    const action = toast?.undo;
    if (!action) return;
    dispatch(toastCleared());
    if (action.kind === 'status') {
      dispatch(
        statusChangeRequested({ code: action.code, to: action.to, force: true, undo: true }),
      );
    } else {
      dispatch(paidChangeRequested({ code: action.code, paid: action.paid, undo: true }));
    }
  }, [dispatch, navigate, toast]);
  const dismissWarning = useCallback(() => dispatch(warningDismissed()), [dispatch]);
  const goAhead = useCallback(() => dispatch(warningConfirmed()), [dispatch]);

  const toastText = toast ? t(`toast.${toast.kind}`, { name: toast.name }) : null;
  const hasButton = Boolean(toast?.undo ?? toast?.open);
  const plain = toast && !hasButton ? toastText : notice === 'nudged' ? t('detail.nudged') : null;
  const code = warned?.warning.code;
  return (
    <>
      <UndoToast
        key={toast?.id ?? 0}
        message={hasButton ? toastText : null}
        actionLabel={toast?.open ? t(toast.open.code ? 'toast.open' : 'toast.show') : undefined}
        onUndo={undo}
        onDismiss={clear}
      />
      <Toast message={plain} onDismiss={clear} />
      {warned ? (
        <WarningDialog
          title={t(`warn.${code ?? 'generic'}.title`, {
            name: warned.name,
            defaultValue: t('warn.generic.title'),
          })}
          cancelLabel={t('warn.back')}
          continueLabel={t('warn.continue')}
          onCancel={dismissWarning}
          onContinue={goAhead}
        >
          {t(`warn.${code ?? 'generic'}.body`, {
            name: warned.name,
            defaultValue: t('warn.generic.body'),
          })}
        </WarningDialog>
      ) : null}
    </>
  );
}
