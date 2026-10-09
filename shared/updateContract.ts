// Saturday tools (stage 7.1; D-027 bulk updates): messages to many customers' inboxes at once.
import type { Fulfilment, OrderStatus } from './domain';
import { isFinalStatus } from './status';
import { isInt, isOneOf, isRecord, parseArray } from './parse';
import { API_ERROR_CODES, parseApiWarning, type ApiErrorCode, type ApiWarning } from './apiError';

export const UPDATE_TEMPLATES = [
  'readyIn',
  'ready',
  'arrived',
  'arrivingIn',
  'outForDelivery',
  'delivered',
  'collected',
  'custom',
] as const;
export type UpdateTemplate = (typeof UPDATE_TEMPLATES)[number];

export const UPDATE_TEXT_MAX = 200;
export const UPDATE_CODES_MAX = 200;
export const UPDATE_MINUTES_MAX = 180;
/** Suggested minute choices for "Ready in…" and "Arriving in…" (the prototype's chips). */
export const UPDATE_MINUTE_CHOICES: ReadonlyArray<number> = [10, 15, 20, 30, 45, 60];

/** Templates that carry a number of minutes. */
export function needsMinutes(template: UpdateTemplate): boolean {
  return template === 'readyIn' || template === 'arrivingIn';
}

/** The status "Also update status" moves an order to, if the template has one. */
export function statusOfTemplate(template: UpdateTemplate): OrderStatus | null {
  switch (template) {
    case 'readyIn':
    case 'ready':
      return 'ready_for_pickup';
    case 'arrivingIn':
    case 'outForDelivery':
      return 'out_for_delivery';
    case 'delivered':
      return 'delivered';
    case 'collected':
      return 'collected';
    case 'arrived':
    case 'custom':
      return null;
  }
}

/** POST /api/seller/updates */
export type SendUpdatesRequest = {
  template: UpdateTemplate;
  minutes?: number;
  text?: string;
  alsoSetStatus?: boolean;
  /** D-062: send to cancelled orders too (without it they answer `order_cancelled`). */
  force?: boolean;
  /** Order codes (forgiving input is accepted: "k7f-2qx"). */
  codes: Array<string>;
};

export type UpdateResult = {
  /** The raw code, or the input text when it was not a code. */
  code: string;
  ok: boolean;
  /** Set when `ok` is false. */
  error?: ApiErrorCode;
  /** Set when `ok` is false because the order needs a "go ahead anyway" (resend with `force`). */
  warning?: ApiWarning;
  /** The status moved on as asked. False when not asked, or when nextStatuses did not allow it. */
  statusChanged?: boolean;
};
export type SendUpdatesResponse = { results: Array<UpdateResult>; sent: number };

export function parseSendUpdatesRequest(input: unknown): SendUpdatesRequest | null {
  if (!isRecord(input)) return null;
  const { template, minutes, text, alsoSetStatus, codes, force } = input;
  if (!isOneOf(UPDATE_TEMPLATES, template)) return null;
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > UPDATE_CODES_MAX) return null;
  if (!codes.every((code): code is string => typeof code === 'string' && code !== '')) return null;
  if (alsoSetStatus !== undefined && typeof alsoSetStatus !== 'boolean') return null;
  if (force !== undefined && typeof force !== 'boolean') return null;
  if (needsMinutes(template) && !isInt(minutes, 1, UPDATE_MINUTES_MAX)) return null;
  if (minutes !== undefined && !isInt(minutes, 1, UPDATE_MINUTES_MAX)) return null;
  let custom: string | undefined;
  if (template === 'custom') {
    if (typeof text !== 'string') return null;
    custom = text.trim();
    if (custom.length < 1 || custom.length > UPDATE_TEXT_MAX) return null;
  }
  return {
    template,
    codes,
    ...(needsMinutes(template) ? { minutes: minutes as number } : {}),
    ...(custom !== undefined ? { text: custom } : {}),
    ...(alsoSetStatus !== undefined ? { alsoSetStatus } : {}),
    ...(force !== undefined ? { force } : {}),
  };
}

function parseResult(input: unknown): UpdateResult | null {
  if (!isRecord(input)) return null;
  const { code, ok, error, statusChanged } = input;
  if (typeof code !== 'string' || typeof ok !== 'boolean') return null;
  if (error !== undefined && !isOneOf(API_ERROR_CODES, error)) return null;
  if (statusChanged !== undefined && typeof statusChanged !== 'boolean') return null;
  const warning = input['warning'] === undefined ? undefined : parseApiWarning(input['warning']);
  if (input['warning'] !== undefined && !warning) return null;
  return {
    code,
    ok,
    ...(error !== undefined ? { error } : {}),
    ...(warning ? { warning } : {}),
    ...(statusChanged !== undefined ? { statusChanged } : {}),
  };
}

export function parseSendUpdatesResponse(input: unknown): SendUpdatesResponse | null {
  if (!isRecord(input)) return null;
  const results = parseArray(input['results'], parseResult);
  return results && isInt(input['sent'], 0, UPDATE_CODES_MAX)
    ? { results, sent: input['sent'] }
    : null;
}

// ---- Recipient groups ----

export const RECIPIENT_GROUPS = ['open', 'pickup', 'delivery', 'notDone'] as const;
export type RecipientGroup = (typeof RECIPIENT_GROUPS)[number];

type Recipient = { code: string; status: OrderStatus; fulfilment: Fulfilment };

/**
 * The codes of a group (the prototype's chips). `open` = every order that is not cancelled;
 * `notDone` = not collected, delivered or cancelled; `pickup` / `delivery` = the not-done orders
 * of that fulfilment. Unknown statuses never match.
 */
export function recipientCodes(
  orders: ReadonlyArray<Recipient>,
  group: RecipientGroup,
): Array<string> {
  const picked = orders.filter((order) => {
    if (order.status === 'cancelled') return false;
    if (group === 'open') return true;
    if (isFinalStatus(order.status)) return false;
    return group === 'notDone' || order.fulfilment === group;
  });
  return picked.map((order) => order.code);
}
