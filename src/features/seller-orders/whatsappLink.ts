import type { i18n as I18n } from 'i18next';
import type { Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import { SELLER_NS } from './i18n/register';
import { orderTotalCents } from './orderText';

/**
 * Opens WhatsApp with the order link written in the customer's language. D-059: the seller picks
 * the chat; no phone number is sent or stored here (the phone's own contacts come in stage 11).
 */
export function openOrderLink(i18n: I18n, order: Order, digits: string | null = null): void {
  const fixed = i18n.getFixedT(order.language, SELLER_NS);
  const text = fixed('linkMsg', {
    name: order.firstName,
    code: formatOrderCode(order.code),
    items: order.lines
      .map((line) => `${line.qty}× ${pickText(line.name, order.language)}`)
      .join(', '),
    total: formatMoney(orderTotalCents(order), order.language),
    how: fixed(`fulfilment.${order.fulfilment}`),
    link: `${window.location.origin}/o/${order.token}`,
  });
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
