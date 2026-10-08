import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Actor, Language, Order } from '../../../shared/domain';
import { pickText } from '../../../shared/text';
import { SELLER_NS } from './i18n/register';

/** The seller's UI language; anything that is not Indonesian shows English. */
export function useLang(): Language {
  const { i18n } = useTranslation(SELLER_NS);
  return i18n.resolvedLanguage === 'id' ? 'id' : 'en';
}

/** "2 Lemper, 1 Tempe" in the seller's language. */
export function itemsSummary(order: Order, lang: Language): string {
  return order.lines.map((line) => `${line.qty} ${pickText(line.name, lang)}`).join(', ');
}

export function orderTotalCents(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
}

/** Staff names are seller-side only (D-012); a customer shows as their first name. */
export function actorLabel(actor: Actor, t: TFunction): string {
  return actor.role === 'chef' ? t('who.chef', { name: actor.name }) : actor.name;
}
