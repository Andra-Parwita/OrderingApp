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
  // Menus and dishes (plan 001, stage 3)
  /** The seller already has 5 saved pickup places (D-061). */
  'pickup_place_limit',
  /** A new menu needs the current one finished first (D-063). */
  'menu_in_progress',
  /** Finish now was asked for a menu that is not live. */
  'menu_not_live',
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
  /** Plan 025: a password through an add-device code, but the account already has one. */
  'password_exists',
  /** Plan 025: the passkey is already registered (this device already holds it). */
  'passkey_exists',
  /** A state-changing call whose `Origin` is missing or is not this site (stage 8.2). */
  'bad_origin',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

// ---- Warnings (D-062: warn, never block; plan 001 stage 4) ----

export const WARNING_CODES = [
  /** The status change skips a step (or leaves a closed order). */
  'status_out_of_order',
  /** The order is already collected, delivered or cancelled. */
  'order_closed',
  /** The order is cancelled (a message or a "collected" mark would reach a cancelled order). */
  'order_cancelled',
  /** "Arriving soon" or a delivery step for an order that is not a delivery. */
  'not_delivery',
  /** "Mark collected" for a delivery order. */
  'not_pickup',
  /** "Packed" with items not ticked; `unticked` lists their item ids. */
  'items_unticked',
  /** The same message type went to the same group a few minutes ago. */
  'repeat_message',
  /** The place has no open orders to reach. */
  'nobody_to_message',
  /** A delivery step before the one it follows. */
  'step_out_of_order',
  /** The same delivery step was already sent for this order. */
  'step_repeated',
  /** Marked collected before the order was ready for pickup. */
  'not_ready',
  /** A seller-entered order takes more portions than are left. */
  'over_limit',
  /** Publishing a menu with no dishes (D-062). */
  'no_dishes',
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

/**
 * What the seller can override. A call that would warn does nothing and answers 409 with this
 * under `warning`; the same call with `force: true` goes ahead.
 */
export type ApiWarning = { code: WarningCode; unticked?: Array<string>; count?: number };

export function parseApiWarning(input: unknown): ApiWarning | null {
  if (!isRecord(input) || !isOneOf(WARNING_CODES, input['code'])) return null;
  const { unticked, count } = input;
  let ids: Array<string> | undefined;
  if (unticked !== undefined) {
    if (!Array.isArray(unticked) || !unticked.every((id) => typeof id === 'string')) return null;
    ids = unticked;
  }
  if (count !== undefined && !isInt(count, 0, 100_000)) return null;
  return {
    code: input['code'],
    ...(ids !== undefined ? { unticked: ids } : {}),
    ...(count !== undefined ? { count } : {}),
  };
}

/**
 * Every 4xx body: `{ error: code, message }`. `triesLeft` rides on `invalid_credentials` and
 * `retryAfterSeconds` on `locked_out`. `warning` rides on an overridable refusal: the `error` is
 * the code the call used to refuse with (`confirm_required` for a new one).
 */
export type ApiErrorBody = {
  error: ApiErrorCode;
  message: string;
  triesLeft?: number;
  retryAfterSeconds?: number;
  warning?: ApiWarning;
};

export function parseApiError(input: unknown): ApiErrorBody | null {
  if (!isRecord(input)) return null;
  const { error, message, triesLeft, retryAfterSeconds } = input;
  if (!isOneOf(API_ERROR_CODES, error) || typeof message !== 'string') return null;
  const warning = input['warning'] === undefined ? undefined : parseApiWarning(input['warning']);
  return {
    error,
    message,
    ...(isInt(triesLeft, 0, 1000) ? { triesLeft } : {}),
    ...(isInt(retryAfterSeconds, 0, 10_000_000) ? { retryAfterSeconds } : {}),
    ...(warning ? { warning } : {}),
  };
}
