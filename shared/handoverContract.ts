// Plan 001 stage 4: packing, messages to a pickup place, delivery steps and "collected". Every
// call here is seller-scoped except the customer's "I've collected it". D-062: a call that would
// warn does nothing and answers 409 `{ error, message, warning }` (see shared/apiError.ts); the
// same call with `force: true` goes ahead. D-059: no request has a phone or address field, and a
// body that carries one is refused by its parser.
import { isInt, isIsoDate, isOneOf, isRecord, parseArray, hasPersonalData } from './parse';
import type { SellerOrder } from './domain';
import { parseOrder } from './orderContract';
import { UPDATE_MINUTES_MAX, UPDATE_TEXT_MAX } from './updateContract';

/** A repeat of the same type to the same group within this many minutes warns (`repeat_message`). */
export const REPEAT_WINDOW_MINUTES = 10;

// ---- Message log ----

export const MESSAGE_TYPES = [
  'ready_in',
  'ready_now',
  'custom',
  'out_for_delivery',
  'arriving_soon',
  'delivered',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

/** `place:<place id>`, `delivery`, or `order:<order code>`. */
export type MessageGroup = string;

export function isMessageGroup(value: unknown): value is MessageGroup {
  if (typeof value !== 'string' || value.length > 80) return false;
  return value === 'delivery' || /^place:.+$/.test(value) || /^order:.+$/.test(value);
}

export type MessageText = { en?: string; id?: string };

/** One row of the log, kept with the menu it was sent for. */
export type MessageLogEntry = {
  id: string;
  menuId: string;
  group: MessageGroup;
  type: MessageType;
  /** `ready_in` and `arriving_soon` (when given). */
  minutes?: number;
  /** `custom` only. */
  text?: MessageText;
  at: string;
  /** How many orders it reached. */
  sentCount: number;
};

export function parseMessageLogEntry(input: unknown): MessageLogEntry | null {
  if (!isRecord(input)) return null;
  const { id, menuId, group, type, minutes, at, sentCount } = input;
  if (typeof id !== 'string' || id === '' || typeof menuId !== 'string' || menuId === '') {
    return null;
  }
  if (!isMessageGroup(group) || !isOneOf(MESSAGE_TYPES, type) || !isIsoDate(at)) return null;
  if (!isInt(sentCount, 0, 100_000)) return null;
  if (minutes !== undefined && !isInt(minutes, 1, UPDATE_MINUTES_MAX)) return null;
  let text: MessageText | undefined;
  if (input['text'] !== undefined) {
    text = parseMessageText(input['text']) ?? undefined;
    if (!text) return null;
  }
  return {
    id,
    menuId,
    group,
    type,
    ...(minutes !== undefined ? { minutes } : {}),
    ...(text ? { text } : {}),
    at,
    sentCount,
  };
}

/** At least one of en / id, each trimmed and within the text limit. */
function parseMessageText(input: unknown): MessageText | null {
  if (!isRecord(input)) return null;
  const out: MessageText = {};
  for (const key of ['en', 'id'] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length > UPDATE_TEXT_MAX) return null;
    if (trimmed !== '') out[key] = trimmed;
  }
  return out.en !== undefined || out.id !== undefined ? out : null;
}

/** GET /api/seller/messages: the log of the current menu, newest first. */
export type MessagesResponse = { messages: Array<MessageLogEntry> };

export function parseMessagesResponse(input: unknown): MessagesResponse | null {
  if (!isRecord(input)) return null;
  const messages = parseArray(input['messages'], parseMessageLogEntry);
  return messages ? { messages } : null;
}

// ---- Pack ----

/**
 * POST /api/seller/orders/:code/pack. `ticked` is the whole set of ticked item ids (replaces the
 * old one); `packed` sets or clears the flag. Packed with an item not ticked warns
 * (`items_unticked`). Packing never touches the status and the customer never sees it.
 */
export type PackRequest = { ticked?: Array<string>; packed?: boolean; force?: boolean };

export function parsePackRequest(input: unknown): PackRequest | null {
  if (!isRecord(input) || hasPersonalData(input)) return null;
  const { ticked, packed, force } = input;
  if (ticked === undefined && packed === undefined) return null;
  const out: PackRequest = {};
  if (ticked !== undefined) {
    if (!Array.isArray(ticked) || ticked.length > 50) return null;
    if (!ticked.every((id): id is string => typeof id === 'string' && id !== '')) return null;
    out.ticked = [...new Set(ticked)];
  }
  if (packed !== undefined) {
    if (typeof packed !== 'boolean') return null;
    out.packed = packed;
  }
  if (force !== undefined) {
    if (typeof force !== 'boolean') return null;
    out.force = force;
  }
  return out;
}

// ---- Message a pickup place ----

/**
 * POST /api/seller/messages/place/:placeId. It reaches every not-finished pickup order of that
 * place on the current menu, through each order's inbox and the live room. `ready_now` also sets
 * those orders to Ready for pickup (D-069 Q3); `ready_in` and `custom` change no status.
 */
export type MessagePlaceRequest =
  | { type: 'ready_in'; minutes: number; force?: boolean }
  | { type: 'ready_now'; force?: boolean }
  | { type: 'custom'; text: MessageText; force?: boolean };

export function parseMessagePlaceRequest(input: unknown): MessagePlaceRequest | null {
  if (!isRecord(input) || hasPersonalData(input)) return null;
  const { type, force } = input;
  if (force !== undefined && typeof force !== 'boolean') return null;
  const forced = force === undefined ? {} : { force };
  if (type === 'ready_now') return { type, ...forced };
  if (type === 'ready_in') {
    return isInt(input['minutes'], 1, UPDATE_MINUTES_MAX)
      ? { type, minutes: input['minutes'], ...forced }
      : null;
  }
  if (type === 'custom') {
    const text = parseMessageText(input['text']);
    return text ? { type, text, ...forced } : null;
  }
  return null;
}

export type MessagePlaceResponse = {
  message: MessageLogEntry;
  /** Orders reached. */
  sent: number;
  /** Orders moved to Ready for pickup (`ready_now` only). */
  readied: number;
};

export function parseMessagePlaceResponse(input: unknown): MessagePlaceResponse | null {
  if (!isRecord(input)) return null;
  const message = parseMessageLogEntry(input['message']);
  if (!message || !isInt(input['sent'], 0, 100_000) || !isInt(input['readied'], 0, 100_000)) {
    return null;
  }
  return { message, sent: input['sent'], readied: input['readied'] };
}

// ---- Delivery steps ----

export const DELIVERY_STEPS = ['out_for_delivery', 'arriving_soon', 'delivered'] as const;
export type DeliveryStep = (typeof DELIVERY_STEPS)[number];

/**
 * POST /api/seller/orders/:code/delivery-step. Out for delivery and Delivered move the status as
 * today's tools do; Arriving soon (with optional minutes) changes none. Each notifies that
 * order's inbox and is logged under `order:<code>`. A step out of order warns (`step_out_of_order`,
 * `step_repeated`, `order_closed`, `not_delivery`).
 */
export type DeliveryStepRequest = { step: DeliveryStep; minutes?: number; force?: boolean };

export function parseDeliveryStepRequest(input: unknown): DeliveryStepRequest | null {
  if (!isRecord(input) || hasPersonalData(input)) return null;
  const { step, minutes, force } = input;
  if (!isOneOf(DELIVERY_STEPS, step)) return null;
  if (
    minutes !== undefined &&
    (step !== 'arriving_soon' || !isInt(minutes, 1, UPDATE_MINUTES_MAX))
  ) {
    return null;
  }
  if (force !== undefined && typeof force !== 'boolean') return null;
  return {
    step,
    ...(minutes !== undefined ? { minutes } : {}),
    ...(force !== undefined ? { force } : {}),
  };
}

export type DeliveryStepResponse = { order: SellerOrder; message: MessageLogEntry };

export function parseDeliveryStepResponse(input: unknown): DeliveryStepResponse | null {
  if (!isRecord(input)) return null;
  const order = parseOrder(input['order']);
  const message = parseMessageLogEntry(input['message']);
  return order && message ? { order, message } : null;
}

// ---- Collected ----

/** POST /api/seller/orders/:code/collected (the quiet "Mark collected"). Body optional. */
export type MarkCollectedRequest = { force?: boolean };

export function parseMarkCollectedRequest(input: unknown): MarkCollectedRequest | null {
  if (input === undefined || input === null) return {};
  if (!isRecord(input) || hasPersonalData(input)) return null;
  if (input['force'] === undefined) return {};
  return typeof input['force'] === 'boolean' ? { force: input['force'] } : null;
}
