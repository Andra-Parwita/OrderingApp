import type { Order } from '../../../shared/domain';

/** Plan 114 follow-up: two orders this close in time can be an accidental double order. */
export const REPEAT_WINDOW_SECONDS = 120;

export type RepeatOf = Readonly<{ code: string; seconds: number }>;

function linesKey(order: Order): string {
  return order.lines
    .map((line) => `${line.itemId}:${line.qty}`)
    .sort()
    .join('|');
}

function eligible(order: Order): boolean {
  return (
    order.customerCode !== undefined &&
    order.customerCode !== '' &&
    order.private === undefined &&
    order.status !== 'cancelled'
  );
}

/**
 * Orders that look like an accidental repeat, keyed by the LATER order's code. Same non-empty
 * customerCode, both menu orders, neither cancelled, created at most 120 s apart, same lines as a
 * multiset of (itemId, qty). Only a note for the seller: nothing is blocked or changed.
 */
export function findRepeats(orders: ReadonlyArray<Order>): ReadonlyMap<string, RepeatOf> {
  const result = new Map<string, RepeatOf>();
  const sorted = orders
    .filter(eligible)
    .map((order) => ({ order, at: Date.parse(order.createdAt), key: linesKey(order) }))
    .filter((entry) => !Number.isNaN(entry.at))
    .sort((a, b) => a.at - b.at);
  for (let i = 1; i < sorted.length; i += 1) {
    const later = sorted[i];
    if (later === undefined) continue;
    for (let j = i - 1; j >= 0; j -= 1) {
      const earlier = sorted[j];
      if (earlier === undefined) continue;
      const seconds = Math.round((later.at - earlier.at) / 1000);
      if (seconds > REPEAT_WINDOW_SECONDS) break;
      if (earlier.order.customerCode === later.order.customerCode && earlier.key === later.key) {
        result.set(later.order.code, { code: earlier.order.code, seconds });
        break;
      }
    }
  }
  return result;
}
