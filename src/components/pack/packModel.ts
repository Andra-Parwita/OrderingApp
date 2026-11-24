import type { Order, PickupPoint } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import { nextStatuses } from '../../../shared/status';

// Pure packing maths shared by the order detail (seller-orders) and, later, Kitchen -> Pack (plan 132).

export type PackProgress = { ticked: number; total: number; packed: boolean };

export function packProgress(order: Order): PackProgress {
  return {
    ticked: order.lines.filter((line) => line.ticked === true).length,
    total: order.lines.length,
    packed: order.packed === true,
  };
}

/** The ids of the ticked lines (the pack API takes and replaces the whole set). */
export function tickedIdsOf(order: Order): Array<string> {
  return order.lines.filter((line) => line.ticked === true).map((line) => line.itemId);
}

/** Cancelled, collected and delivered orders are not packed any more; an empty order has nothing to pack. */
export function canPack(order: Order): boolean {
  return order.lines.length > 0 && order.status !== 'cancelled' && nextStatuses(order).length > 0;
}

/**
 * The status the Ready button sets for this order, or null when it is not a step from here. A delivery
 * order has none: its button only marks the bag Packed; "Out for delivery" is a separate tap (plan 132).
 */
export function readyTarget(order: Pick<Order, 'status' | 'fulfilment'>): Order['status'] | null {
  if (order.fulfilment !== 'pickup') return null;
  return nextStatuses(order).includes('ready_for_pickup') ? 'ready_for_pickup' : null;
}

// Deliveries sort after the pickups.
const LAST = '￿';

/**
 * The next order still to pack after `fromCode` (wrapping round), by pickup time, then place, then
 * code. duplicate of seller-cook/packModel sortBags('time') + nextUnpacked (plan 132): a feature may
 * not import another feature.
 */
export function nextToPack(
  orders: ReadonlyArray<Order>,
  points: ReadonlyArray<PickupPoint>,
  fromCode: string,
): Order | null {
  const keyOf = (order: Order): Array<string> => {
    const point =
      order.fulfilment === 'pickup'
        ? (points.find((candidate) => candidate.id === order.pickupPlaceId) ?? points[0])
        : undefined;
    return [
      order.private?.eventTime ?? point?.window.start ?? LAST,
      point?.place ?? LAST,
      formatOrderCode(order.code),
    ];
  };
  const sorted = orders
    .filter(canPack)
    .map((order) => ({ order, key: keyOf(order) }))
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i += 1) {
        const diff = (a.key[i] ?? '').localeCompare(b.key[i] ?? '');
        if (diff !== 0) return diff;
      }
      return 0;
    })
    .map((entry) => entry.order);
  const start = sorted.findIndex((order) => order.code === fromCode);
  for (let step = 1; step <= sorted.length; step += 1) {
    const order = sorted[(start + step) % sorted.length];
    if (order && order.packed !== true && order.code !== fromCode) return order;
  }
  return null;
}

/** The order's total: the sum of its lines. */
export function orderSumCents(order: Order): number {
  return order.lines.reduce((cents, line) => cents + line.priceCents * line.qty, 0);
}

/** A size such as "Mild · 1 plate" with the number and its unit kept on one line. */
export function keepPortion(size: string): string {
  return size.replace(/(\d) (?=\p{L})/gu, '$1 ');
}
