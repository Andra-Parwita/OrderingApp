import { localDate } from '../../../shared/dates';
import type { CustomerOrder, Fulfilment, InboxEntry, OrderStatus } from '../../../shared/domain';

export type StepState = 'done' | 'current' | 'todo';
export type TimelineStep = Readonly<{ status: OrderStatus; state: StepState }>;

/** The statuses an order passes through, by how it is handed over. */
function path(fulfilment: Fulfilment): ReadonlyArray<OrderStatus> {
  return fulfilment === 'delivery'
    ? ['ordered', 'confirmed', 'out_for_delivery', 'delivered']
    : ['ordered', 'confirmed', 'ready_for_pickup', 'collected'];
}

/**
 * Ordered, Confirmed, Ready / Out, Collected / Delivered. Once the last step is reached every
 * step is done. A cancelled order shows only Ordered (done) and Cancelled (current).
 */
export function timelineSteps(
  status: OrderStatus,
  fulfilment: Fulfilment,
): ReadonlyArray<TimelineStep> {
  if (status === 'cancelled') {
    return [
      { status: 'ordered', state: 'done' },
      { status: 'cancelled', state: 'current' },
    ];
  }
  const steps = path(fulfilment);
  const at = steps.indexOf(status);
  const last = steps.length - 1;
  return steps.map((step, index) => ({
    status: step,
    state: index < at || at === last ? 'done' : index === at ? 'current' : 'todo',
  }));
}

export function isFinal(status: OrderStatus): boolean {
  return status === 'collected' || status === 'delivered' || status === 'cancelled';
}

export function orderTotalCents(order: CustomerOrder): number {
  return order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
}

/** Newest first, whatever order the server sent. */
export function inboxNewestFirst(inbox: ReadonlyArray<InboxEntry>): Array<InboxEntry> {
  return [...inbox].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * Which section an order sits in. With the week's cooking date: current when that date is today
 * or later in the cook's zone. Without it, an order that is not finished is.
 */
export function isThisWeek(
  order: CustomerOrder,
  cookingDate: string | null,
  now: Date = new Date(),
): boolean {
  if (cookingDate === null) return !isFinal(order.status);
  return cookingDate >= localDate(now);
}

export type InboxText =
  Readonly<{ kind: 'own'; text: string }> | Readonly<{ kind: 'key'; key: string; minutes: number }>;

/** What one Updates line says: the seller's own text, an app message key, or the status. */
export function inboxText(entry: InboxEntry): InboxText {
  if (entry.text !== undefined && entry.text !== '') return { kind: 'own', text: entry.text };
  const minutes = entry.minutes ?? 0;
  if (entry.textKey !== undefined) return { kind: 'key', key: `inbox.${entry.textKey}`, minutes };
  if (entry.status !== undefined)
    return { kind: 'key', key: `inbox.status.${entry.status}`, minutes };
  return { kind: 'key', key: 'inbox.other', minutes };
}
