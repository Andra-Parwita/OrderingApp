import type { CustomerOrder, Language } from '../../../shared/domain';
import { formatCookingDate, formatWindow } from '../../../shared/dates';
import type { MenuResponse } from '../../../shared/menuContract';
import { pickText } from '../../../shared/text';
import { pickupMapInfo, type PickupMapInfo } from '../../components/pickup-map';

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
  /** Plan 076: the pickup place's address line and map, when it has an address. */
  pickupMap: PickupMapInfo | undefined;
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
  // Plan 081: a private order has its own event date and time (the kitchen's wall clock, shown in
  // the device's zone like a pickup window); it is not tied to the weekly menu's date.
  const event = order.private;
  const date = event?.eventDate ?? order.cookingDate ?? week?.cookingDate;
  const dateText = date ? formatCookingDate(date, lang) : null;
  const windowText = event
    ? event.eventTime
      ? // One time: format a zero-length window and keep the second half ("12–12 pm" -> "12 pm").
        (formatWindow(event.eventTime, event.eventTime, lang, event.eventDate).split('–')[1] ??
        null)
      : null
    : pickup
      ? formatWindow(pickup.window.start, pickup.window.end, lang, date ?? undefined)
      : null;
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
    pickupMap: pickupMapInfo(pickup, lang, menu?.mapsEmbedKey, dateText),
  };
}
