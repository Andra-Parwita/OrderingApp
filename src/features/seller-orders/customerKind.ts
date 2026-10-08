import type { Order } from '../../../shared/domain';
import { nextStatuses } from '../../../shared/status';

export type CustomerKind = 'new' | 'returning' | 'waReceived';

/** i18n key of the marker text for each kind. */
export const KIND_MARK = {
  new: 'orders.newCustomer',
  returning: 'orders.returning',
  waReceived: 'orders.waReceived',
} as const;

/**
 * For a customer-placed order still waiting for confirmation: is this person new (wait for their
 * WhatsApp message), returning (can confirm), or already heard from? Otherwise null.
 */
export function customerKind(order: Order): CustomerKind | null {
  if (order.status !== 'ordered' || order.enteredBy) return null;
  if (order.returning) return 'returning';
  return order.waReceived ? 'waReceived' : 'new';
}

/** The diff of the latest customer edit, shown in the Changed banner. */
export function latestDiff(order: Order) {
  const edits = order.audit.filter((entry) => entry.what === 'edited' && entry.diff);
  edits.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return edits[0]?.diff ?? null;
}

export type AttentionFlag = 'new' | 'edited' | 'note' | 'locked';

/**
 * The single thing about an order that needs the seller's eye, for the desktop table (D-031).
 * Priority: New customer, then Edited by customer, then Note, then Locked. A finished order
 * (no next step) needs nothing, so it shows none.
 */
export function attentionFlag(order: Order): AttentionFlag | null {
  if (nextStatuses(order).length === 0) return null;
  if (customerKind(order) === 'new') return 'new';
  if (order.changed) return 'edited';
  if (order.note) return 'note';
  if (order.locked) return 'locked';
  return null;
}
