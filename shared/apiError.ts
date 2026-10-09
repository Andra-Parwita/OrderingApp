import { isOneOf, isRecord } from './parse';

export const API_ERROR_CODES = [
  'invalid_request',
  'not_found',
  'seller_not_found',
  'cutoff_passed',
  'week_not_published',
  'unknown_item',
  'sold_out',
  'exceeds_remaining',
  'invalid_status',
  'order_locked',
  'ordering_closed',
  'item_has_orders',
  'limit_reached',
  'no_items',
  'confirm_required',
  'week_not_draft',
  'week_closed',
  'unknown_chef',
  'image_type',
  'image_too_big',
  'image_ratio',
  'invalid_backup',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Every 4xx body: `{ error: code, message }`. */
export type ApiErrorBody = { error: ApiErrorCode; message: string };

export function parseApiError(input: unknown): ApiErrorBody | null {
  if (!isRecord(input)) return null;
  const { error, message } = input;
  if (!isOneOf(API_ERROR_CODES, error) || typeof message !== 'string') return null;
  return { error, message };
}
