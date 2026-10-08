import type {
  Actor,
  AuditEntry,
  Fulfilment,
  Language,
  Order,
  OrderLine,
  StaffActor,
} from './domain';
import { AUDIT_MAX, FIRST_NAME_MAX, MAX_MENU_ITEMS, MAX_QTY, NOTE_MAX } from './limits';
import {
  isInt,
  isIsoDate,
  isLanguage,
  isOneOf,
  isRecord,
  parseArray,
  parseLocalText,
} from './parse';
import { ORDER_STATUSES } from './status';

const FULFILMENTS: ReadonlyArray<Fulfilment> = ['pickup', 'delivery'];

/** One requested line; the server snapshots the item's names, size and price. */
export type RequestedLine = { itemId: string; qty: number };

/** POST /api/orders (customer) and POST /api/seller/orders (seller or chef). */
export type CreateOrderRequest = {
  firstName: string;
  language: Language;
  lines: Array<RequestedLine>;
  fulfilment: Fulfilment;
  note?: string;
};

/** PATCH /api/orders/:token. At least one field; an empty note clears it. */
export type UpdateOrderRequest = {
  lines?: Array<RequestedLine>;
  fulfilment?: Fulfilment;
  note?: string;
};

/** Responses of the order endpoints that return one order. */
export type OrderResponse = { order: Order };
/** GET /api/seller/orders, newest first. */
export type OrdersResponse = { orders: Array<Order> };

function parseRequestedLine(input: unknown): RequestedLine | null {
  if (!isRecord(input)) return null;
  const { itemId, qty } = input;
  if (typeof itemId !== 'string' || itemId === '' || !isInt(qty, 1, MAX_QTY)) return null;
  return { itemId, qty };
}

/** 1 to 10 lines, no item twice. */
function parseRequestedLines(input: unknown): Array<RequestedLine> | null {
  const lines = parseArray(input, parseRequestedLine);
  if (!lines || lines.length === 0 || lines.length > MAX_MENU_ITEMS) return null;
  if (new Set(lines.map((line) => line.itemId)).size !== lines.length) return null;
  return lines;
}

/** Trimmed note; returns null if too long. An empty note comes back as ''. */
function parseNote(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const note = input.trim();
  return note.length <= NOTE_MAX ? note : null;
}

export function parseCreateOrderRequest(input: unknown): CreateOrderRequest | null {
  if (!isRecord(input)) return null;
  const { firstName, language, fulfilment } = input;
  if (typeof firstName !== 'string') return null;
  const name = firstName.trim();
  if (name === '' || name.length > FIRST_NAME_MAX) return null;
  if (!isLanguage(language) || !isOneOf(FULFILMENTS, fulfilment)) return null;
  const lines = parseRequestedLines(input['lines']);
  if (!lines) return null;
  let note: string | undefined;
  if (input['note'] !== undefined) {
    const parsed = parseNote(input['note']);
    if (parsed === null) return null;
    if (parsed !== '') note = parsed;
  }
  return {
    firstName: name,
    language,
    lines,
    fulfilment,
    ...(note !== undefined ? { note } : {}),
  };
}

export function parseUpdateOrderRequest(input: unknown): UpdateOrderRequest | null {
  if (!isRecord(input)) return null;
  const out: UpdateOrderRequest = {};
  if (input['lines'] !== undefined) {
    const lines = parseRequestedLines(input['lines']);
    if (!lines) return null;
    out.lines = lines;
  }
  if (input['fulfilment'] !== undefined) {
    if (!isOneOf(FULFILMENTS, input['fulfilment'])) return null;
    out.fulfilment = input['fulfilment'];
  }
  if (input['note'] !== undefined) {
    const note = parseNote(input['note']);
    if (note === null) return null;
    out.note = note;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseOrderLine(input: unknown): OrderLine | null {
  if (!isRecord(input)) return null;
  const name = parseLocalText(input['name']);
  const size = parseLocalText(input['size']);
  const { itemId, priceCents, qty } = input;
  if (typeof itemId !== 'string' || !name || !size) return null;
  if (!isInt(priceCents, 0, 1_000_000) || !isInt(qty, 1, MAX_QTY)) return null;
  return { itemId, name, size, priceCents, qty };
}

function parseActor(input: unknown): Actor | null {
  if (!isRecord(input)) return null;
  const { role, name } = input;
  if (!isOneOf(['customer', 'seller', 'chef'], role) || typeof name !== 'string') return null;
  return { role, name };
}

function parseStaffActor(input: unknown): StaffActor | null {
  const actor = parseActor(input);
  return actor && actor.role !== 'customer' ? { role: actor.role, name: actor.name } : null;
}

function parseAuditEntry(input: unknown): AuditEntry | null {
  if (!isRecord(input)) return null;
  const by = parseActor(input['by']);
  const { what, detail, at } = input;
  if (!by || !isOneOf(['created', 'edited', 'status', 'paid'], what) || !isIsoDate(at)) {
    return null;
  }
  if (detail !== undefined && typeof detail !== 'string') return null;
  return { by, what, ...(detail !== undefined ? { detail } : {}), at };
}

export function parseOrder(input: unknown): Order | null {
  if (!isRecord(input)) return null;
  const { id, code, token, firstName, language, fulfilment, note, status, paid } = input;
  const { createdAt, updatedAt } = input;
  const lines = parseArray(input['lines'], parseOrderLine);
  const audit = parseArray(input['audit'], parseAuditEntry);
  if (typeof id !== 'string' || typeof code !== 'string' || typeof token !== 'string') return null;
  if (typeof firstName !== 'string' || !isLanguage(language)) return null;
  if (!isOneOf(FULFILMENTS, fulfilment) || !isOneOf(ORDER_STATUSES, status)) return null;
  if (note !== undefined && typeof note !== 'string') return null;
  if (typeof paid !== 'boolean' || !isIsoDate(createdAt) || !isIsoDate(updatedAt)) return null;
  if (!lines || !audit || audit.length > AUDIT_MAX) return null;
  let enteredBy: StaffActor | undefined;
  if (input['enteredBy'] !== undefined) {
    const parsed = parseStaffActor(input['enteredBy']);
    if (!parsed) return null;
    enteredBy = parsed;
  }
  return {
    id,
    code,
    token,
    firstName,
    language,
    lines,
    fulfilment,
    ...(note !== undefined ? { note } : {}),
    status,
    paid,
    ...(enteredBy ? { enteredBy } : {}),
    audit,
    createdAt,
    updatedAt,
  };
}

export function parseOrderResponse(input: unknown): OrderResponse | null {
  if (!isRecord(input)) return null;
  const order = parseOrder(input['order']);
  return order ? { order } : null;
}

export function parseOrdersResponse(input: unknown): OrdersResponse | null {
  if (!isRecord(input)) return null;
  const orders = parseArray(input['orders'], parseOrder);
  return orders ? { orders } : null;
}
