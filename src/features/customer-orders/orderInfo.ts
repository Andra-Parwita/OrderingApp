import type { CustomerOrder, Language } from '../../../shared/domain';
import { formatCookingDate, formatWindow } from '../../../shared/dates';
import type { MenuResponse } from '../../../shared/menuContract';
import { pickText } from '../../../shared/text';

/** What the order screens need from the order and the kitchen's menu (which may not be loaded). */
export type OrderInfo = Readonly<{
  kitchenName: string;
  /** The cook, as in "pay {cook}" and "Message {cook} on WhatsApp". */
  cook: string;
  logoSrc: string | undefined;
  whatsappNumber: string | undefined;
  /** "Sat 17 Oct": the closed week's date, else the current menu's. */
  dateText: string | null;
  /** "2–5 pm" of the chosen pickup place. */
  windowText: string | null;
  /** The pickup place of a pickup order. */
  place: string | undefined;
  directions: string;
  /** "Sat 17 Oct, 2–5 pm". */
  whenText: string | null;
}>;

export function orderInfo(
  order: CustomerOrder,
  menu: MenuResponse | undefined,
  lang: Language,
): OrderInfo {
  // A closed week's order must not borrow the pickup places of the menu that replaced it.
  const week =
    menu && order.cookingDate && menu.week.cookingDate !== order.cookingDate
      ? undefined
      : menu?.week;
  // The place the customer chose at checkout; an older order has none and counts as the first.
  const pickup =
    order.fulfilment === 'pickup'
      ? (week?.pickupPoints.find((point) => point.id === order.pickupPlaceId) ??
        week?.pickupPoints[0])
      : undefined;
  const date = order.cookingDate ?? week?.cookingDate;
  const dateText = date ? formatCookingDate(date, lang) : null;
  const windowText = pickup ? formatWindow(pickup.window.start, pickup.window.end, lang) : null;
  return {
    kitchenName: menu?.kitchen.name ?? order.seller.name,
    cook: menu?.seller.name ?? order.seller.name,
    logoSrc: menu?.kitchen.images?.railImage ?? undefined,
    whatsappNumber: menu?.kitchen.whatsappNumber,
    dateText,
    windowText,
    place: pickup?.place,
    directions: pickup ? pickText(pickup.directions, lang) : '',
    whenText: dateText && windowText ? `${dateText}, ${windowText}` : dateText,
  };
}
