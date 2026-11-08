import { formatCookingDate } from '../../../shared/dates';
import type { Language, Order } from '../../../shared/domain';
import { DayTag } from './DayChips';

/**
 * Plan 126: the small day tag ("Mon 16 Nov") on a delivery order whose day is not the event day. Orders
 * on the event day (and every pickup order) get nothing, so a menu without extra days looks as before.
 */
export function OrderDayTag({
  order,
  lang,
}: Readonly<{ order: Pick<Order, 'fulfilment' | 'handoverDate'>; lang: Language }>) {
  if (order.fulfilment !== 'delivery' || order.handoverDate === undefined) return null;
  return <DayTag>{formatCookingDate(order.handoverDate, lang)}</DayTag>;
}
