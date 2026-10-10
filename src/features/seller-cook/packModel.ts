import type { Order, PickupPoint } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';

// Pure Kitchen · Pack maths (D-066). Cancelled orders and orders without items have no bag.

export type PackSort = 'time' | 'place' | 'code';

export type Bag = {
  order: Order;
  code: string;
  /** The pickup place name, or null for a delivery. */
  place: string | null;
  /** "HH:MM" the pickup window opens; null for a delivery. */
  time: string | null;
  ticked: number;
  total: number;
  packed: boolean;
};

export function bagsOf(
  orders: ReadonlyArray<Order>,
  points: ReadonlyArray<PickupPoint> | undefined,
  /** Chef filter: only orders with a line for which this is true; ticks count those lines. */
  own: (itemId: string) => boolean = () => true,
): Array<Bag> {
  const list = points ?? [];
  return orders
    .filter((order) => order.status !== 'cancelled' && order.lines.some((line) => own(line.itemId)))
    .map((order) => {
      const mine = order.lines.filter((line) => own(line.itemId));
      const point =
        order.fulfilment === 'pickup'
          ? (list.find((candidate) => candidate.id === order.pickupPlaceId) ?? list[0])
          : undefined;
      return {
        order,
        code: formatOrderCode(order.code),
        place: point?.place ?? null,
        time: point?.window.start ?? null,
        ticked: mine.filter((line) => line.ticked === true).length,
        total: mine.length,
        packed: order.packed === true,
      };
    });
}

// Deliveries sort after the pickups.
const LAST = '￿';

export function sortBags(bags: ReadonlyArray<Bag>, sort: PackSort): Array<Bag> {
  const key = (bag: Bag): Array<string> => {
    switch (sort) {
      case 'time':
        return [bag.time ?? LAST, bag.place ?? LAST, bag.code];
      case 'place':
        return [bag.place ?? LAST, bag.time ?? LAST, bag.code];
      case 'code':
        return [bag.code];
      default: {
        const unreachable: never = sort;
        return unreachable;
      }
    }
  };
  return [...bags].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    for (let i = 0; i < left.length; i += 1) {
      const diff = (left[i] ?? '').localeCompare(right[i] ?? '');
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

/** The next bag still to pack after `fromCode`, wrapping round; null when none is left. */
export function nextUnpacked(bags: ReadonlyArray<Bag>, fromCode: string): Bag | null {
  const start = bags.findIndex((bag) => bag.order.code === fromCode);
  for (let step = 1; step <= bags.length; step += 1) {
    const bag = bags[(start + step) % bags.length];
    if (bag && !bag.packed && bag.order.code !== fromCode) return bag;
  }
  return null;
}

/** The whole set of ticked item ids after flipping one line (the pack API replaces the set). */
export function toggledIds(order: Order, itemId: string): Array<string> {
  const ids = new Set(order.lines.filter((line) => line.ticked === true).map((l) => l.itemId));
  if (ids.has(itemId)) ids.delete(itemId);
  else ids.add(itemId);
  return [...ids];
}

export function withTicks(order: Order, ids: ReadonlyArray<string>): Order {
  return {
    ...order,
    lines: order.lines.map((line) => {
      const next = { ...line };
      if (ids.includes(line.itemId)) next.ticked = true;
      else delete next.ticked;
      return next;
    }),
  };
}
