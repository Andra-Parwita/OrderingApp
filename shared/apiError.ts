import { isInt, isOneOf, isRecord } from './parse';

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
  // Sign-in (stage 7.1)
  /** No valid session for a call that needs one. */
  'unauthorized',
  /** A valid session whose role may not do this. */
  'forbidden',
  /** One plain code for a wrong, expired or used-up key, code, password or passkey. */
  'invalid_credentials',
  /** Too many failed tries; `retryAfterSeconds` says how long. */
  'locked_out',
  'slug_taken',
  'admin_exists',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/**
 * Every 4xx body: `{ error: code, message }`. `triesLeft` rides on `invalid_credentials` and
 * `retryAfterSeconds` on `locked_out`.
 */
export type ApiErrorBody = {
  error: ApiErrorCode;
  message: string;
  triesLeft?: number;
  retryAfterSeconds?: number;
};

export function parseApiError(input: unknown): ApiErrorBody | null {
  if (!isRecord(input)) return null;
  const { error, message, triesLeft, retryAfterSeconds } = input;
  if (!isOneOf(API_ERROR_CODES, error) || typeof message !== 'string') return null;
  return {
    error,
    message,
    ...(isInt(triesLeft, 0, 1000) ? { triesLeft } : {}),
    ...(isInt(retryAfterSeconds, 0, 10_000_000) ? { retryAfterSeconds } : {}),
  };
}
