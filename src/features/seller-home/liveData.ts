import { localDate } from '../../../shared/dates';
import type { LocalText, Order } from '../../../shared/domain';
import type { MenuView } from '../../../shared/menusContract';
import { summariseOrders } from '../../../shared/pastWeeks';

// What the live Home (states 3 and 4) shows, worked out from the menu and its orders. Pure, so it
// is tested without rendering. Cancelled orders count only in the "cancelled" number.

const live = (orders: ReadonlyArray<Order>) =>
  orders.filter((order) => order.status !== 'cancelled');
const cents = (order: Order) =>
  order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);

export type LiveNumbers = Readonly<{
  orders: number;
  cancelled: number;
  totalCents: number;
  paidCents: number;
  toConfirm: number;
  changed: number;
  unpaidCount: number;
  unpaidCents: number;
}>;

export function liveNumbers(orders: ReadonlyArray<Order>): LiveNumbers {
  const totals = summariseOrders(orders);
  const open = live(orders);
  return {
    orders: totals.orders,
    cancelled: totals.cancelled,
    totalCents: totals.incomeCents,
    paidCents: totals.paidCents,
    toConfirm: open.filter((order) => order.status === 'ordered').length,
    changed: open.filter((order) => order.changed).length,
    unpaidCount: open.filter((order) => !order.paid).length,
    unpaidCents: totals.unpaidCents,
  };
}

export type DishStock = Readonly<{
  id: string;
  name: LocalText;
  sold: number;
  /** Portions left of the limit; null when there is no limit. */
  left: number | null;
  limit: number | null;
  soldOut: boolean;
}>;

/** Every dish on the menu with the portions sold (not cancelled) and what is left of its limit. */
export function dishStock(view: MenuView, orders: ReadonlyArray<Order>): Array<DishStock> {
  const sold = new Map<string, number>();
  for (const order of live(orders)) {
    for (const line of order.lines) sold.set(line.itemId, (sold.get(line.itemId) ?? 0) + line.qty);
  }
  return view.dishes.map((dish) => {
    const count = sold.get(dish.id) ?? 0;
    const limit = dish.limit ?? null;
    const left = limit === null ? null : Math.max(0, limit - count);
    return {
      id: dish.id,
      name: dish.name,
      sold: count,
      left,
      limit,
      soldOut: dish.soldOut === true || dish.manualSoldOut === true || left === 0,
    };
  });
}

/** At or below this many portions left, "N left" turns to the warning colour. */
export const LOW_STOCK = 5;

export type PlaceLoad = Readonly<{
  id: string;
  kind: 'pickup' | 'delivery';
  name: string;
  /** Pickup window, "HH:MM". */
  window?: Readonly<{ start: string; end: string }>;
  orders: number;
  packed: number;
  /** Collected (pickup) or delivered. */
  handedOver: number;
}>;

const handedOver = (order: Order) =>
  order.fulfilment === 'delivery' ? order.status === 'delivered' : order.collectedAt !== undefined;

/** Each pickup place of the menu, then delivery (when it is on or has orders). */
export function placeLoads(view: MenuView, orders: ReadonlyArray<Order>): Array<PlaceLoad> {
  const open = live(orders);
  const first = view.pickupPoints[0]?.id;
  const pickups = open.filter((order) => order.fulfilment === 'pickup');
  const deliveries = open.filter((order) => order.fulfilment === 'delivery');
  const load = (list: ReadonlyArray<Order>) => ({
    orders: list.length,
    packed: list.filter((order) => order.packed === true).length,
    handedOver: list.filter(handedOver).length,
  });
  const loads: Array<PlaceLoad> = view.pickupPoints.map((place) => ({
    id: place.id,
    kind: 'pickup',
    name: place.place,
    window: place.window,
    ...load(pickups.filter((order) => (order.pickupPlaceId ?? first) === place.id)),
  }));
  if (view.menu.delivery.available || deliveries.length > 0) {
    loads.push({ id: 'delivery', kind: 'delivery', name: '', ...load(deliveries) });
  }
  return loads;
}

export type Bar = Readonly<{ done: number; of: number }>;

/** The cooking day's three bars: packed (all orders), collected (pickups), delivered (deliveries). */
export function cookingProgress(
  orders: ReadonlyArray<Order>,
): Record<'packed' | 'collected' | 'delivered', Bar> {
  const open = live(orders);
  const pickups = open.filter((order) => order.fulfilment === 'pickup');
  const deliveries = open.filter((order) => order.fulfilment === 'delivery');
  return {
    packed: { done: open.filter((order) => order.packed === true).length, of: open.length },
    collected: { done: pickups.filter(handedOver).length, of: pickups.length },
    delivered: { done: deliveries.filter(handedOver).length, of: deliveries.length },
  };
}

/** The unpaid orders' count and sum (cancelled orders are not owed). */
export function unpaidOf(orders: ReadonlyArray<Order>): Readonly<{ count: number; cents: number }> {
  const owed = live(orders).filter((order) => !order.paid);
  return { count: owed.length, cents: owed.reduce((sum, order) => sum + cents(order), 0) };
}

const ZONE = 'Australia/Melbourne';

/** The clock in the cook's zone, "HH:MM". */
export function localClock(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

/** A pickup window that is open right now (on the cooking day, between its start and end). */
export function isRunningNow(
  window: Readonly<{ start: string; end: string }>,
  cookingDate: string,
  now: Date,
): boolean {
  const clock = localClock(now);
  return localDate(now) === cookingDate && clock >= window.start && clock < window.end;
}

export type TimeLeft =
  | Readonly<{ kind: 'dh'; days: number; hours: number }>
  | Readonly<{ kind: 'hm'; hours: number; minutes: number }>
  | Readonly<{ kind: 'm'; minutes: number }>;

/** How long until the cut-off: days and hours, hours and minutes, or minutes. */
export function timeLeft(cutoffAt: string, now: Date): TimeLeft {
  const minutes = Math.max(0, Math.floor((Date.parse(cutoffAt) - now.getTime()) / 60_000));
  if (minutes >= 1440)
    return {
      kind: 'dh',
      days: Math.floor(minutes / 1440),
      hours: Math.floor((minutes % 1440) / 60),
    };
  if (minutes >= 60) return { kind: 'hm', hours: Math.floor(minutes / 60), minutes: minutes % 60 };
  return { kind: 'm', minutes };
}
