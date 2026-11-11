import type { SellerOrder } from './domain';

// Plan 130: a customer order that is still Ordered 24 hours after it was placed, with no "WhatsApp
// received" tick, is cancelled by the app (the kitchen has no phone number to ask). The seller can
// restore it; a restored order is never cancelled again.

/** How long after it was placed an unconfirmed customer order is cancelled. */
export const AUTO_CANCEL_HOURS = 24;
/** In the last this-many hours the seller's list warns "Cancels at …". */
export const AUTO_CANCEL_WARN_HOURS = 2;
/**
 * The 24 hours count from the later of the order's `createdAt` and this moment, so orders already
 * there when the rule ships get a full day after the release (no surprise batch at deploy).
 */
export const AUTO_CANCEL_SINCE = '2026-11-12T00:00:00+10:30';
/** The reason code in the order's change history (audit `detail` of the cancel). */
export const AUTO_CANCEL_REASON = 'not_confirmed_24h';
/** The audit `detail` of a restore. */
export const RESTORED_DETAIL = 'restored';
/** The name the change history shows for what the app did by itself. */
export const AUTO_CANCEL_ACTOR = 'App';
/** The customer's inbox key of the reason text. */
export const AUTO_CANCEL_INBOX_KEY = 'autoCancelled';

const HOUR_MS = 3_600_000;

/** When the app cancels an order placed at `createdAt` (ISO), as an ISO instant. */
export function autoCancelAt(createdAt: string): string {
  const from = Math.max(Date.parse(createdAt), Date.parse(AUTO_CANCEL_SINCE));
  return new Date(from + AUTO_CANCEL_HOURS * HOUR_MS).toISOString();
}

type Subject = Pick<SellerOrder, 'status' | 'waReceived' | 'enteredBy' | 'audit' | 'createdAt'> & {
  private?: unknown;
};

/** Whether the order has ever been restored by the seller (from the kept change history). */
export function wasRestored(order: Pick<SellerOrder, 'audit'>): boolean {
  return order.audit.some((entry) => entry.detail === RESTORED_DETAIL);
}

/** A customer-placed, unconfirmed order the app may still cancel (time aside). */
export function isAutoCancelCandidate(order: Subject): boolean {
  return (
    order.status === 'ordered' &&
    !order.waReceived &&
    order.enteredBy === undefined &&
    order.private === undefined &&
    !wasRestored(order)
  );
}

/** The seller's "⚠ Cancels at" warning: a candidate in the last AUTO_CANCEL_WARN_HOURS. */
export function isAutoCancelSoon(order: Subject, now: number): boolean {
  if (!isAutoCancelCandidate(order)) return false;
  const at = Date.parse(autoCancelAt(order.createdAt));
  return now < at && now >= at - AUTO_CANCEL_WARN_HOURS * HOUR_MS;
}

/** The change-history entry of an automatic cancel, when the order is cancelled that way. */
export function autoCancelEntry(order: Pick<SellerOrder, 'status' | 'audit'>) {
  if (order.status !== 'cancelled') return undefined;
  return order.audit.find(
    (entry) => entry.what === 'status' && entry.detail === AUTO_CANCEL_REASON,
  );
}
