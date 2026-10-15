import type { CustomerOrder, Language, PickupPoint } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatWindow } from '../../../shared/dates';
import { pickText } from '../../../shared/text';

/** What the line and the panel show for one pickup place that has an address. */
export type PickupMapInfo = Readonly<{
  place: string;
  address: string;
  lat?: number;
  lng?: number;
  /** "2–5 pm", or "Sat 17 Oct, 2–5 pm". Absent in the seller's address check. */
  whenText?: string | null;
  /** How to find it, in the customer's language. */
  directions?: string;
  /** The public Maps Embed key; without it the panel shows the address and Directions only. */
  mapsKey?: string | undefined;
}>;

/** The info for a place, or undefined when it has no address (then nothing is drawn at all). */
export function pickupMapInfo(
  point: PickupPoint | undefined,
  lang: Language,
  mapsKey?: string,
  dateText?: string | null,
): PickupMapInfo | undefined {
  if (!point?.address) return undefined;
  const window = formatWindow(point.window.start, point.window.end, lang);
  return {
    place: point.place,
    address: point.address,
    ...(point.lat !== undefined && point.lng !== undefined
      ? { lat: point.lat, lng: point.lng }
      : {}),
    whenText: dateText ? `${dateText}, ${window}` : window,
    directions: pickText(point.directions, lang),
    mapsKey,
  };
}

/**
 * The info for the pickup place of an order (the place chosen at checkout, else the menu's first),
 * or undefined: a delivery order, no menu yet, a menu of another week, or a place without address.
 */
export function pickupMapInfoForOrder(
  order: CustomerOrder,
  menu: MenuResponse | undefined,
  lang: Language,
  dateText?: string | null,
): PickupMapInfo | undefined {
  if (order.fulfilment !== 'pickup' || !menu) return undefined;
  // A closed week's order must not borrow the pickup places of the menu that replaced it.
  if (order.cookingDate && menu.week.cookingDate !== order.cookingDate) return undefined;
  const points = menu.week.pickupPoints;
  const point = points.find((p) => p.id === order.pickupPlaceId) ?? points[0];
  return pickupMapInfo(point, lang, menu.mapsEmbedKey, dateText);
}
