import type { AuditEntry, Order } from '../../../shared/domain';
import { orderTotalCents } from './orderText';

/** A paid order whose total changed after it was paid (plan 105): what was paid, what it is now. */
export type PaidGap = Readonly<{ paidCents: number; totalCents: number; gapCents: number }>;

/**
 * Found from the audit (it keeps 4 entries, D-013): the payment (or the creation, for an order
 * entered as paid) and the first seller edit after it, whose `total.from` is what was paid. Null
 * when the order is not paid, nothing changed since, or the payment has scrolled out of the audit.
 */
export function paidGap(order: Order): PaidGap | null {
  if (!order.paid) return null;
  const newestFirst: Array<AuditEntry> = [...order.audit].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  );
  const base = newestFirst.findIndex(
    (entry) => (entry.what === 'paid' && entry.detail === 'paid') || entry.what === 'created',
  );
  if (base < 0) return null;
  const firstEdit = newestFirst
    .slice(0, base)
    .reverse()
    .find((entry) => entry.what === 'edited' && entry.diff?.total !== undefined);
  const paidCents = firstEdit?.diff?.total?.from;
  if (paidCents === undefined) return null;
  const totalCents = orderTotalCents(order);
  const gapCents = totalCents - paidCents;
  return gapCents === 0 ? null : { paidCents, totalCents, gapCents };
}

/** The newest audit entry when it is a seller edit (the panel says so until something else happens). */
export function lastStaffEdit(order: Order): AuditEntry | null {
  const newest = [...order.audit].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  return newest?.what === 'edited' && newest.by.role !== 'customer' ? newest : null;
}
