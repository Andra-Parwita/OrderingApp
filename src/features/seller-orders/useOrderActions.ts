import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import type { AuditEntry, Language, Order } from '../../../shared/domain';
import { formatAuditDiff } from '../../../shared/auditDiff';
import { formatOrderCode } from '../../../shared/orderCode';
import { nextStatuses } from '../../../shared/status';
import { SELLER_NS } from './i18n/register';
import { customerKind, latestDiff } from './customerKind';
import { useLang } from './orderText';
import { selectChange } from './sellerOrdersSelectors';
import {
  lockChangeRequested,
  nudgeRequested,
  paidChangeRequested,
  seenRequested,
  statusChangeRequested,
  waReceivedRequested,
  type FailedChange,
} from './sellerOrdersSlice';

type TFn = ReturnType<typeof useTranslation>['t'];

export function auditText(entry: AuditEntry, t: TFn, lang: Language): string {
  switch (entry.what) {
    case 'created':
      return t('audit.created');
    case 'edited':
      return entry.diff
        ? t('audit.editedDiff', { diff: formatAuditDiff(entry.diff, lang) })
        : t('audit.edited');
    case 'status':
      return t('audit.status', { status: t(`status.${entry.detail ?? ''}`) });
    case 'paid':
      return entry.detail === 'unpaid' ? t('audit.unpaid') : t('audit.paid');
    default: {
      const unreachable: never = entry.what;
      return unreachable;
    }
  }
}

function sortedAudit(audit: ReadonlyArray<AuditEntry>): Array<AuditEntry> {
  // D-013: up to 4 entries, newest first.
  return [...audit].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 4);
}

/** What the phone page and the desktop panel both need to show and change one order. */
export function useOrderActions(order: Order) {
  const { i18n } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const change = useSelector(selectChange);
  const saving = change.status === 'saving';
  const failed: FailedChange | null =
    change.status === 'error' && change.failed.code === order.code ? change.failed : null;

  const steps = nextStatuses(order);
  const forward = steps.filter((status) => status !== 'cancelled');
  const canCancel = steps.includes('cancelled');
  const final = steps.length === 0;
  const audit = useMemo(() => sortedAudit(order.audit), [order.audit]);
  const kind = customerKind(order);
  const diff = useMemo(() => (order.changed ? latestDiff(order) : null), [order]);
  const lastEdit = useMemo(
    () => order.audit.find((entry) => entry.what === 'edited')?.at ?? order.updatedAt,
    [order.audit, order.updatedAt],
  );

  const setPaid = useCallback(
    (paid: boolean) => dispatch(paidChangeRequested({ code: order.code, paid })),
    [dispatch, order.code],
  );
  const onWaReceived = useCallback(
    () => dispatch(waReceivedRequested({ code: order.code, received: true })),
    [dispatch, order.code],
  );
  const onNudge = useCallback(
    () => dispatch(nudgeRequested({ code: order.code })),
    [dispatch, order.code],
  );
  const onSeen = useCallback(
    () => dispatch(seenRequested({ code: order.code })),
    [dispatch, order.code],
  );
  const onLock = useCallback(
    () => dispatch(lockChangeRequested({ code: order.code, locked: !order.locked })),
    [dispatch, order.code, order.locked],
  );
  const onCancel = useCallback(
    () => dispatch(statusChangeRequested({ code: order.code, to: 'cancelled' })),
    [dispatch, order.code],
  );
  const onStep = useCallback(
    (to: Order['status']) => dispatch(statusChangeRequested({ code: order.code, to })),
    [dispatch, order.code],
  );
  const onWhatsApp = useCallback(() => {
    // The message is in the customer's language, not the seller's.
    const fixed = i18n.getFixedT(order.language, SELLER_NS);
    const text = fixed('whatsapp.message', {
      name: order.firstName,
      code: formatOrderCode(order.code),
      link: `${window.location.origin}/o/${order.token}`,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }, [i18n, order]);
  const onRetry = useCallback(() => {
    if (!failed) return;
    switch (failed.kind) {
      case 'status':
        dispatch(statusChangeRequested({ code: failed.code, to: failed.to }));
        break;
      case 'paid':
        dispatch(paidChangeRequested({ code: failed.code, paid: failed.paid }));
        break;
      case 'lock':
        dispatch(lockChangeRequested({ code: failed.code, locked: failed.locked }));
        break;
      case 'wa':
        dispatch(waReceivedRequested({ code: failed.code, received: failed.received }));
        break;
      case 'nudge':
        dispatch(nudgeRequested({ code: failed.code }));
        break;
      case 'seen':
        dispatch(seenRequested({ code: failed.code }));
        break;
      default: {
        const unreachable: never = failed;
        throw new Error(String(unreachable));
      }
    }
  }, [dispatch, failed]);

  return {
    lang,
    saving,
    failed,
    forward,
    canCancel,
    final,
    audit,
    kind,
    diff,
    lastEdit,
    setPaid,
    onWaReceived,
    onNudge,
    onSeen,
    onLock,
    onCancel,
    onStep,
    onWhatsApp,
    onRetry,
  };
}
export type OrderActions = ReturnType<typeof useOrderActions>;
