import type { OrderStatus } from './domain';
import { isOneOf, isRecord } from './parse';
import { ORDER_STATUSES } from './status';

/** POST /api/seller/orders/:code/status; `to` must be in nextStatuses(order). */
export type SetStatusRequest = { to: OrderStatus };
/** POST /api/seller/orders/:code/paid */
export type SetPaidRequest = { paid: boolean };

export function parseSetStatusRequest(input: unknown): SetStatusRequest | null {
  if (!isRecord(input) || !isOneOf(ORDER_STATUSES, input['to'])) return null;
  return { to: input['to'] };
}

export function parseSetPaidRequest(input: unknown): SetPaidRequest | null {
  if (!isRecord(input) || typeof input['paid'] !== 'boolean') return null;
  return { paid: input['paid'] };
}
