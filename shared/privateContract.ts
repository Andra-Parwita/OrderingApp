// Plan 081: private (Khusus) orders. Only the owner makes, edits and cancels one; chefs and helpers read
// them and move their status through the usual order routes. No phone number anywhere (D-007); the
// delivery address is the one personal field (D-099), exactly as on a menu order.
import { parseDeliveryAddress, type DeliveryAddress } from './address';
import type { Fulfilment, Language, SellerOrder } from './domain';
import { FIRST_NAME_MAX, MAX_MENU_ITEMS, MAX_QTY, NOTE_MAX } from './limits';
import { hasPersonalData, isInt, isLanguage, isOneOf, isRecord, parseArray } from './parse';

const FULFILMENTS: ReadonlyArray<Fulfilment> = ['pickup', 'delivery'];
export const PRIVATE_MAX_PRICE_CENTS = 1_000_000;
export const PRIVATE_MAX_DEPOSIT_CENTS = 100_000_000;

/** A library dish on the order. `priceCents` defaults to the dish's price (a per-order price). */
export type PrivateLineInput = { dishId: string; qty: number; priceCents?: number };

/** POST /api/seller/private (owner only). New orders start on delivery and unpaid. */
export type CreatePrivateRequest = {
  firstName: string;
  language: Language;
  /** Kitchen-local date, YYYY-MM-DD (required). */
  eventDate: string;
  /** Kitchen wall clock, HH:MM. */
  eventTime?: string;
  /** Default `delivery`. */
  fulfilment?: Fulfilment;
  /** For pickup: one of the kitchen's pickup places (default: the first one, as menu orders do). */
  pickupPlaceId?: string;
  /** Delivery address, kept encrypted (D-099). */
  address?: DeliveryAddress;
  note?: string;
  paid?: boolean;
  depositCents?: number;
  /** 1 to 50 lines, no dish twice. */
  lines: Array<PrivateLineInput>;
};

/** PATCH /api/seller/private/<code> (owner only). At least one field; `null` / '' clears. */
export type UpdatePrivateRequest = {
  firstName?: string;
  language?: Language;
  eventDate?: string;
  eventTime?: string | null;
  fulfilment?: Fulfilment;
  pickupPlaceId?: string | null;
  address?: DeliveryAddress | null;
  note?: string;
  paid?: boolean;
  depositCents?: number | null;
  /** Replaces all lines. */
  lines?: Array<PrivateLineInput>;
};

/** Private orders due on the kitchen's today / tomorrow (not cancelled): the count on More. */
export type PrivateDue = { today: number; tomorrow: number };

/**
 * GET /api/seller/private?view=upcoming|past (default upcoming), `&day=today` (today's, not cancelled;
 * overrides view), `&due=1` (counts only: `orders` is empty). Upcoming: event date today or later and
 * not cancelled, soonest first. Past: earlier or cancelled, latest first. `today` is the kitchen-local
 * date the server used. Orders carry `address` like every seller order answer.
 */
export type PrivateListResponse = { orders: Array<SellerOrder>; due: PrivateDue; today: string };

/** One chef's share of a day's private orders (cancelled ones excluded). `chefId` null = no chef. */
export type PrivateChefRow = {
  chefId: string | null;
  chefName?: string;
  qty: number;
  cents: number;
};
/** GET /api/seller/private/chef-summary?date=YYYY-MM-DD */
export type PrivateChefSummaryResponse = { date: string; rows: Array<PrivateChefRow> };

// POST, PATCH and cancel answer with the usual `{ order }` (SellerOrderResponse).

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isEventDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export function isEventTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

function parseLine(input: unknown): PrivateLineInput | null {
  if (!isRecord(input)) return null;
  const { dishId, qty, priceCents } = input;
  if (typeof dishId !== 'string' || dishId === '' || dishId.length > 64) return null;
  if (!isInt(qty, 1, MAX_QTY)) return null;
  if (priceCents !== undefined && !isInt(priceCents, 0, PRIVATE_MAX_PRICE_CENTS)) return null;
  return { dishId, qty, ...(priceCents !== undefined ? { priceCents } : {}) };
}

function parseLines(input: unknown): Array<PrivateLineInput> | null {
  const lines = parseArray(input, parseLine);
  if (!lines || lines.length === 0 || lines.length > MAX_MENU_ITEMS) return null;
  return new Set(lines.map((line) => line.dishId)).size === lines.length ? lines : null;
}

function parseName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim();
  return name !== '' && name.length <= FIRST_NAME_MAX ? name : null;
}

function parseNote(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const note = input.trim();
  return note.length <= NOTE_MAX ? note : null;
}

function parsePlaceId(input: unknown): string | null {
  return typeof input === 'string' && input !== '' && input.length <= 64 ? input : null;
}

function withoutAddress(input: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...input };
  delete rest['address'];
  return rest;
}

export function parseCreatePrivateRequest(input: unknown): CreatePrivateRequest | null {
  if (!isRecord(input) || hasPersonalData(withoutAddress(input))) return null;
  const firstName = parseName(input['firstName']);
  const lines = parseLines(input['lines']);
  const { language, eventDate } = input;
  if (firstName === null || lines === null || !isLanguage(language) || !isEventDate(eventDate)) {
    return null;
  }
  const out: CreatePrivateRequest = { firstName, language, eventDate, lines };
  if (input['eventTime'] !== undefined) {
    if (!isEventTime(input['eventTime'])) return null;
    out.eventTime = input['eventTime'];
  }
  if (input['fulfilment'] !== undefined) {
    if (!isOneOf(FULFILMENTS, input['fulfilment'])) return null;
    out.fulfilment = input['fulfilment'];
  }
  if (input['pickupPlaceId'] !== undefined) {
    const place = parsePlaceId(input['pickupPlaceId']);
    if (place === null) return null;
    out.pickupPlaceId = place;
  }
  if (input['address'] !== undefined) {
    const address = parseDeliveryAddress(input['address']);
    if (address === null) return null;
    out.address = address;
  }
  if (input['note'] !== undefined) {
    const note = parseNote(input['note']);
    if (note === null) return null;
    if (note !== '') out.note = note;
  }
  if (input['paid'] !== undefined) {
    if (typeof input['paid'] !== 'boolean') return null;
    out.paid = input['paid'];
  }
  if (input['depositCents'] !== undefined) {
    if (!isInt(input['depositCents'], 0, PRIVATE_MAX_DEPOSIT_CENTS)) return null;
    out.depositCents = input['depositCents'];
  }
  return out;
}

export function parseUpdatePrivateRequest(input: unknown): UpdatePrivateRequest | null {
  if (!isRecord(input) || hasPersonalData(withoutAddress(input))) return null;
  const out: UpdatePrivateRequest = {};
  if (input['firstName'] !== undefined) {
    const name = parseName(input['firstName']);
    if (name === null) return null;
    out.firstName = name;
  }
  if (input['language'] !== undefined) {
    if (!isLanguage(input['language'])) return null;
    out.language = input['language'];
  }
  if (input['eventDate'] !== undefined) {
    if (!isEventDate(input['eventDate'])) return null;
    out.eventDate = input['eventDate'];
  }
  if (input['eventTime'] !== undefined) {
    if (input['eventTime'] === null) out.eventTime = null;
    else if (isEventTime(input['eventTime'])) out.eventTime = input['eventTime'];
    else return null;
  }
  if (input['fulfilment'] !== undefined) {
    if (!isOneOf(FULFILMENTS, input['fulfilment'])) return null;
    out.fulfilment = input['fulfilment'];
  }
  if (input['pickupPlaceId'] !== undefined) {
    if (input['pickupPlaceId'] === null) out.pickupPlaceId = null;
    else {
      const place = parsePlaceId(input['pickupPlaceId']);
      if (place === null) return null;
      out.pickupPlaceId = place;
    }
  }
  if (input['address'] !== undefined) {
    if (input['address'] === null) out.address = null;
    else {
      const address = parseDeliveryAddress(input['address']);
      if (address === null) return null;
      out.address = address;
    }
  }
  if (input['note'] !== undefined) {
    const note = parseNote(input['note']);
    if (note === null) return null;
    out.note = note;
  }
  if (input['paid'] !== undefined) {
    if (typeof input['paid'] !== 'boolean') return null;
    out.paid = input['paid'];
  }
  if (input['depositCents'] !== undefined) {
    if (input['depositCents'] === null) out.depositCents = null;
    else if (isInt(input['depositCents'], 0, PRIVATE_MAX_DEPOSIT_CENTS)) {
      out.depositCents = input['depositCents'];
    } else return null;
  }
  if (input['lines'] !== undefined) {
    const lines = parseLines(input['lines']);
    if (lines === null) return null;
    out.lines = lines;
  }
  return Object.keys(out).length > 0 ? out : null;
}
