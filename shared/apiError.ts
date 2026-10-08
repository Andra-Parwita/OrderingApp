import { isOneOf, isRecord } from './parse';

export const API_ERROR_CODES = [
  'invalid_request',
  'not_found',
  'cutoff_passed',
  'week_not_published',
  'unknown_item',
  'sold_out',
  'exceeds_remaining',
  'invalid_status',
  'order_locked',
  'ordering_closed',
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
