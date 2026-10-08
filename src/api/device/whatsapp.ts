import type { TFunction } from 'i18next';
import type { CustomerOrder } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';

/**
 * The pre-filled WhatsApp text, in the customer's language (`t` must be fixed to it and carry the
 * `wa.*` strings). The note is left out on purpose: the seller sees it in the app (D-018).
 * `when` is e.g. "Sat 10 Oct, 2–5 pm"; without it the message just says Pickup.
 */
export function buildWhatsAppText(order: CustomerOrder, t: TFunction, when: string | null): string {
  const lang = order.language;
  const items = order.lines.map((line) => `${line.qty}× ${pickText(line.name, lang)}`).join(', ');
  const total = order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
  const how =
    order.fulfilment === 'delivery'
      ? t('wa.delivery')
      : when
        ? t('wa.pickupWhen', { when })
        : t('wa.pickup');
  const text = t('wa.message', {
    code: formatOrderCode(order.code),
    items,
    total: formatMoney(total, lang),
    how,
    name: order.firstName,
  });
  return order.fulfilment === 'delivery' ? `${text} ${t('wa.addAddress')}` : text;
}

/** The seller's chat when the number is known, else WhatsApp's own chat picker. */
export function whatsAppUrl(text?: string, number?: string): string {
  const base = `https://wa.me/${number ?? ''}`;
  return text === undefined ? base : `${base}?text=${encodeURIComponent(text)}`;
}
