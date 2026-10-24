import i18n from 'i18next';
import type { Order } from '../../../shared/domain';
import { formatAuditDiff } from '../../../shared/auditDiff';
import { orderPath } from '../../../shared/orderPath';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { SELLER_NS } from './i18n/register';
import { orderTotalCents } from './orderText';

/**
 * Plan 105: the WhatsApp text offered after a seller edit ("Copy message"), in the customer's
 * language: the order number, what changed, the new total and the order link.
 */
export function editCopyMessage(order: Order): string | undefined {
  const diff = order.audit.find((entry) => entry.what === 'edited' && entry.diff)?.diff;
  if (!diff) return undefined;
  return i18n.getFixedT(order.language, SELLER_NS)('whatsapp.edited', {
    name: order.firstName,
    code: formatOrderCode(order.code),
    diff: formatAuditDiff(diff, order.language),
    total: formatMoney(orderTotalCents(order), order.language),
    link: `${window.location.origin}${orderPath(currentSellerSlug(), order.token)}`,
  });
}
