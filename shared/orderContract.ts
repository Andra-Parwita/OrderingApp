import type {
  Actor,
  AuditDiff,
  AuditEntry,
  CollectedBy,
  CustomerOrder,
  Fulfilment,
  InboxEntry,
  Language,
  OrderAddress,
  OrderLine,
  PrivateInfo,
  SellerOrder,
  SellerRef,
  StaffActor,
} from './domain';
import { AUDIT_MAX, FIRST_NAME_MAX, INBOX_MAX, MAX_MENU_ROWS, MAX_QTY, NOTE_MAX } from './limits';
import {
  hasPersonalData,
  isInt,
  isIsoDate,
  isLanguage,
  isOneOf,
  isRecord,
  parseArray,
  parseLocalText,
} from './parse';
import { parseDeliveryAddress, type DeliveryAddress } from './address';
import { isEventDate, isEventTime, PRIVATE_MAX_DEPOSIT_CENTS } from './privateContract';
import { parseCustomerCode } from './customerCode';
import { parseOrderCode } from './orderCode';
import { isValidSlug } from './seller';
import { ORDER_STATUSES } from './status';

const FULFILMENTS: ReadonlyArray<Fulfilment> = ['pickup', 'delivery'];
const COLLECTED_BY: ReadonlyArray<CollectedBy> = ['customer', 'seller'];
const INBOX_KINDS: ReadonlyArray<InboxEntry['kind']> = ['status', 'nudge', 'message'];

/** One requested line; the server snapshots the item's names, size and price. */
export type RequestedLine = {
  itemId: string;
  qty: number;
  /** Plan 111: a short note for this line (trimmed, at most NOTE_MAX). '' removes it; never stored empty. */
  note?: string;
};

/** POST /api/s/:slug/orders (customer; the seller comes from the slug). */
export type CreateOrderRequest = {
  firstName: string;
  language: Language;
  lines: Array<RequestedLine>;
  fulfilment: Fulfilment;
  note?: string;
  /** Customer only: the phone's own My orders history holds a collected/delivered order. */
  returning?: boolean;
  /**
   * plan 001 stage 4: the pickup place (one of the menu's) for a pickup order; the customer picks
   * it at checkout when the menu uses more than one (stage 12). Ignored for a delivery order. No phone
   * field exists here, or anywhere else in a request (D-007). The delivery `address` below is the one
   * deliberate exception (plan 071, D-099).
   */
  pickupPlaceId?: string;
  /**
   * plan 071 (D-099): an optional delivery address (guided fields), kept encrypted
   * for the kitchen's team and deleted a day after the menu ends. Ignored unless the order is a
   * delivery and the server has its key. Phone numbers stay out of every request (D-007).
   */
  address?: DeliveryAddress;
  /**
   * plan 071 (D-099): the anonymous customer code the customer's phone made for this kitchen. Optional
   * (old apps send none). Stored on the order and returned in seller reads only.
   */
  customerCode?: string;
};

/** POST /api/seller/orders (seller or chef, in the X-Seller seller; D-027 row 8). Defaults: confirmNow true, paid false. */
export type CreateSellerOrderRequest = Omit<CreateOrderRequest, 'returning'> & {
  confirmNow?: boolean;
  paid?: boolean;
  /** D-062: go ahead although the order takes more portions than are left (`over_limit`). */
  force?: boolean;
};

/** PATCH /api/orders/:token. At least one field; an empty note clears it. */
export type UpdateOrderRequest = {
  lines?: Array<RequestedLine>;
  fulfilment?: Fulfilment;
  note?: string;
  /** plan 071: the new address; `null` deletes it. */
  address?: DeliveryAddress | null;
};

/**
 * PATCH /api/seller/orders/:code/fulfilment (plan 083; owner and chef). Pickup needs a place of the
 * kitchen, delivery an address with a street; `notify` tells the customer (inbox entry + push).
 */
export type ChangeFulfilmentRequest = {
  fulfilment: Fulfilment;
  pickupPlaceId?: string;
  address?: DeliveryAddress;
  notify: boolean;
};

/**
 * PATCH /api/seller/orders/:code (plan 105; owner and chef). Any order, any status: lines (the whole
 * new list), note ('' clears it) and first name change; `notify` tells the customer (inbox entry +
 * push); `force` goes ahead over a portion limit (D-062); `reactivate` puts a cancelled order back to
 * Ordered. Pickup / delivery keeps its own route.
 */
export type EditSellerOrderRequest = {
  lines?: Array<RequestedLine>;
  note?: string;
  firstName?: string;
  notify: boolean;
  force?: boolean;
  reactivate?: boolean;
};

/**
 * A closed-week order whose details were dropped after 4 weeks (D-044 / D-027 row 6): only whose
 * and which week it was is left, enough to show "archived on <date> from <seller>".
 */
export type ExpiredOrder = {
  archived: true;
  expired: true;
  token: string;
  seller: SellerRef;
  /** Local date (YYYY-MM-DD) of the closed week. */
  cookingDate: string;
};

/** Customer endpoints (by token) that return one order. */
export type CustomerOrderResponse = { order: CustomerOrder };
/** POST /api/s/:slug/orders/find (D-075): get a lost order back by its code and first name. */
export type FindOrderRequest = { code: string; firstName: string };
/** Only the private token; the client then opens the order the usual way. */
export type FindOrderResponse = { token: string };

export function parseFindOrderRequest(input: unknown): FindOrderRequest | null {
  if (!isRecord(input)) return null;
  const code = typeof input['code'] === 'string' ? parseOrderCode(input['code']) : null;
  const name = typeof input['firstName'] === 'string' ? input['firstName'].trim() : '';
  if (code === null || name === '' || name.length > FIRST_NAME_MAX) return null;
  return { code, firstName: name };
}

export function parseFindOrderResponse(input: unknown): FindOrderResponse | null {
  return isRecord(input) && typeof input['token'] === 'string' && input['token'] !== ''
    ? { token: input['token'] }
    : null;
}
/** GET /api/orders/:token: the order (maybe archived and read-only), or its expired summary. */
export type FetchedOrderResponse = CustomerOrderResponse | { expired: ExpiredOrder };
/** GET /api/orders?tokens=a,b (max 20); unknown tokens are omitted. */
export type CustomerOrdersResponse = {
  orders: Array<CustomerOrder>;
  /** Tokens whose order details are gone but whose week is still known. */
  expired?: Array<ExpiredOrder>;
};
/** Seller endpoints that return one order. */
export type SellerOrderResponse = { order: SellerOrder };
/** GET /api/seller/orders, newest first. */
export type SellerOrdersResponse = { orders: Array<SellerOrder> };

/** Narrows a full order to what the customer may see (copies fields, so nothing else leaks). */
export function toCustomerOrder(order: SellerOrder, seller: SellerRef): CustomerOrder {
  return {
    id: order.id,
    seller: { slug: seller.slug, name: seller.name },
    code: order.code,
    token: order.token,
    firstName: order.firstName,
    language: order.language,
    // Packing ticks are the seller's: copy the fields a customer may see, nothing else (D-066).
    lines: order.lines.map((line): OrderLine => ({
      itemId: line.itemId,
      name: line.name,
      size: line.size,
      priceCents: line.priceCents,
      qty: line.qty,
      ...(line.note !== undefined ? { note: line.note } : {}),
    })),
    fulfilment: order.fulfilment,
    ...(order.note !== undefined ? { note: order.note } : {}),
    status: order.status,
    locked: order.locked,
    // The Paid pill on the customer's order page (stage 6); the seller sets it.
    paid: order.paid,
    inbox: order.inbox,
    ...(order.pickupPlaceId !== undefined ? { pickupPlaceId: order.pickupPlaceId } : {}),
    ...(order.collectedAt !== undefined ? { collectedAt: order.collectedAt } : {}),
    ...(order.private ? { private: privateCustomerView(order) } : {}),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/** Plan 081: the event and what is still to pay (nothing once the order is marked paid). */
function privateCustomerView(order: SellerOrder): NonNullable<CustomerOrder['private']> {
  const info = order.private as NonNullable<SellerOrder['private']>;
  const total = order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
  return {
    eventDate: info.eventDate,
    ...(info.eventTime !== undefined ? { eventTime: info.eventTime } : {}),
    ...(info.depositCents !== undefined ? { depositCents: info.depositCents } : {}),
    toPayCents: order.paid ? 0 : Math.max(0, total - (info.depositCents ?? 0)),
  };
}

/** The customer view of an order of a closed week: the same, marked read-only with its week's date. */
export function toArchivedOrder(
  order: SellerOrder,
  seller: SellerRef,
  cookingDate: string,
): CustomerOrder {
  return { ...toCustomerOrder(order, seller), archived: true, cookingDate };
}

export function toExpiredOrder(
  token: string,
  seller: SellerRef,
  cookingDate: string,
): ExpiredOrder {
  return {
    archived: true,
    expired: true,
    token,
    seller: { slug: seller.slug, name: seller.name },
    cookingDate,
  };
}

function parseRequestedLine(input: unknown): RequestedLine | null {
  if (!isRecord(input)) return null;
  const { itemId, qty } = input;
  if (typeof itemId !== 'string' || itemId === '' || !isInt(qty, 1, MAX_QTY)) return null;
  if (input['note'] === undefined) return { itemId, qty };
  // '' is kept so a seller edit can clear a note (an absent note keeps it); it is never stored.
  const note = parseNote(input['note']);
  return note === null ? null : { itemId, qty, note };
}

/** 1 to 10 lines, no item twice. */
function parseRequestedLines(input: unknown): Array<RequestedLine> | null {
  const lines = parseArray(input, parseRequestedLine);
  if (!lines || lines.length === 0 || lines.length > MAX_MENU_ROWS) return null;
  if (new Set(lines.map((line) => line.itemId)).size !== lines.length) return null;
  return lines;
}

/** Trimmed note; returns null if too long. An empty note comes back as ''. */
function parseNote(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const note = input.trim();
  return note.length <= NOTE_MAX ? note : null;
}

/** The address is the one personal field an order request may carry (D-099); the rest stay refused. */
function withoutAddress(input: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...input };
  delete rest['address'];
  return rest;
}

type CreateCore = Omit<CreateOrderRequest, 'returning'>;

function parseCreateCore(input: unknown): CreateCore | null {
  if (!isRecord(input) || hasPersonalData(withoutAddress(input))) return null;
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
  let address: DeliveryAddress | undefined;
  if (input['address'] !== undefined) {
    const parsed = parseDeliveryAddress(input['address']);
    if (parsed === null) return null;
    address = parsed;
  }
  let customerCode: string | undefined;
  if (input['customerCode'] !== undefined) {
    const parsed = parseCustomerCode(input['customerCode']);
    if (parsed === null) return null;
    customerCode = parsed;
  }
  const placeId = input['pickupPlaceId'];
  if (
    placeId !== undefined &&
    (typeof placeId !== 'string' || placeId === '' || placeId.length > 64)
  ) {
    return null;
  }
  return {
    firstName: name,
    language,
    lines,
    fulfilment,
    ...(note !== undefined ? { note } : {}),
    ...(placeId !== undefined ? { pickupPlaceId: placeId } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(customerCode !== undefined ? { customerCode } : {}),
  };
}

export function parseCreateOrderRequest(input: unknown): CreateOrderRequest | null {
  const core = parseCreateCore(input);
  if (!core || !isRecord(input)) return null;
  const returning = input['returning'];
  if (returning === undefined) return core;
  return typeof returning === 'boolean' ? { ...core, returning } : null;
}

export function parseCreateSellerOrderRequest(input: unknown): CreateSellerOrderRequest | null {
  const core = parseCreateCore(input);
  if (!core || !isRecord(input)) return null;
  const { confirmNow, paid, force } = input;
  if (confirmNow !== undefined && typeof confirmNow !== 'boolean') return null;
  if (paid !== undefined && typeof paid !== 'boolean') return null;
  if (force !== undefined && typeof force !== 'boolean') return null;
  return {
    ...core,
    ...(confirmNow !== undefined ? { confirmNow } : {}),
    ...(paid !== undefined ? { paid } : {}),
    ...(force !== undefined ? { force } : {}),
  };
}

export function parseUpdateOrderRequest(input: unknown): UpdateOrderRequest | null {
  if (!isRecord(input) || hasPersonalData(withoutAddress(input))) return null;
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
  if (input['address'] !== undefined) {
    if (input['address'] === null) out.address = null;
    else {
      const address = parseDeliveryAddress(input['address']);
      if (address === null) return null;
      out.address = address;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseChangeFulfilmentRequest(input: unknown): ChangeFulfilmentRequest | null {
  if (!isRecord(input) || hasPersonalData(withoutAddress(input))) return null;
  const { fulfilment, pickupPlaceId, notify } = input;
  if (!isOneOf(FULFILMENTS, fulfilment) || typeof notify !== 'boolean') return null;
  if (fulfilment === 'pickup') {
    if (typeof pickupPlaceId !== 'string' || pickupPlaceId === '' || pickupPlaceId.length > 64) {
      return null;
    }
    return { fulfilment, pickupPlaceId, notify };
  }
  const address = parseDeliveryAddress(input['address']);
  return address ? { fulfilment, address, notify } : null;
}

export function parseEditSellerOrderRequest(input: unknown): EditSellerOrderRequest | null {
  if (!isRecord(input) || hasPersonalData(input)) return null;
  const { notify, force, reactivate } = input;
  if (typeof notify !== 'boolean') return null;
  if (force !== undefined && typeof force !== 'boolean') return null;
  if (reactivate !== undefined && typeof reactivate !== 'boolean') return null;
  const out: EditSellerOrderRequest = { notify };
  if (input['lines'] !== undefined) {
    const lines = parseRequestedLines(input['lines']);
    if (!lines) return null;
    out.lines = lines;
  }
  if (input['note'] !== undefined) {
    const note = parseNote(input['note']);
    if (note === null) return null;
    out.note = note;
  }
  if (input['firstName'] !== undefined) {
    const name = typeof input['firstName'] === 'string' ? input['firstName'].trim() : '';
    if (name === '' || name.length > FIRST_NAME_MAX) return null;
    out.firstName = name;
  }
  if (force !== undefined) out.force = force;
  if (reactivate !== undefined) out.reactivate = reactivate;
  return out;
}

function parseOrderLine(input: unknown): OrderLine | null {
  if (!isRecord(input)) return null;
  const name = parseLocalText(input['name']);
  const size = parseLocalText(input['size']);
  const { itemId, priceCents, qty } = input;
  if (typeof itemId !== 'string' || !name || !size) return null;
  if (!isInt(priceCents, 0, 1_000_000) || !isInt(qty, 1, MAX_QTY)) return null;
  if (input['ticked'] !== undefined && typeof input['ticked'] !== 'boolean') return null;
  const chefId = input['chefId'];
  if (chefId !== undefined && (typeof chefId !== 'string' || chefId === '')) return null;
  const note = input['note'];
  if (note !== undefined && (typeof note !== 'string' || note === '' || note.length > NOTE_MAX)) {
    return null;
  }
  return {
    itemId,
    name,
    size,
    priceCents,
    qty,
    ...(note !== undefined ? { note } : {}),
    ...(chefId !== undefined ? { chefId } : {}),
    ...(input['ticked'] === true ? { ticked: true } : {}),
  };
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

function parseAuditDiff(input: unknown): AuditDiff | null {
  if (!isRecord(input)) return null;
  const items = parseArray(input['items'], (item) => {
    if (!isRecord(item)) return null;
    const name = parseLocalText(item['name']);
    const { itemId, delta } = item;
    if (typeof itemId !== 'string' || !name || !isInt(delta, -MAX_QTY, MAX_QTY)) return null;
    return { itemId, name, delta };
  });
  if (!items) return null;
  const { note, fulfilment } = input;
  if (note !== undefined && note !== true) return null;
  const diff: AuditDiff = { items };
  if (note === true) diff.note = true;
  if (fulfilment !== undefined) {
    if (!isRecord(fulfilment)) return null;
    const { from, to } = fulfilment;
    if (!isOneOf(FULFILMENTS, from) || !isOneOf(FULFILMENTS, to)) return null;
    diff.fulfilment = { from, to };
  }
  const { name, total } = input;
  if (name !== undefined) {
    if (!isRecord(name) || typeof name['from'] !== 'string' || typeof name['to'] !== 'string') {
      return null;
    }
    diff.name = { from: name['from'], to: name['to'] };
  }
  if (total !== undefined) {
    if (!isRecord(total)) return null;
    const { from, to } = total;
    if (!isInt(from, 0, 100_000_000) || !isInt(to, 0, 100_000_000)) return null;
    diff.total = { from, to };
  }
  return diff;
}

function parseAuditEntry(input: unknown): AuditEntry | null {
  if (!isRecord(input)) return null;
  const by = parseActor(input['by']);
  const { what, detail, at } = input;
  if (!by || !isOneOf(['created', 'edited', 'status', 'paid'], what) || !isIsoDate(at)) {
    return null;
  }
  if (detail !== undefined && typeof detail !== 'string') return null;
  let diff: AuditDiff | undefined;
  if (input['diff'] !== undefined) {
    const parsed = parseAuditDiff(input['diff']);
    if (!parsed) return null;
    diff = parsed;
  }
  return {
    by,
    what,
    ...(detail !== undefined ? { detail } : {}),
    ...(diff ? { diff } : {}),
    at,
  };
}

function parseInboxEntry(input: unknown): InboxEntry | null {
  if (!isRecord(input)) return null;
  const { at, kind, status, textKey, text, minutes } = input;
  if (!isIsoDate(at) || !isOneOf(INBOX_KINDS, kind)) return null;
  if (status !== undefined && !isOneOf(ORDER_STATUSES, status)) return null;
  if (textKey !== undefined && typeof textKey !== 'string') return null;
  if (text !== undefined && typeof text !== 'string') return null;
  if (minutes !== undefined && !isInt(minutes, 0, 10_000)) return null;
  return {
    at,
    kind,
    ...(status !== undefined ? { status } : {}),
    ...(textKey !== undefined ? { textKey } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(minutes !== undefined ? { minutes } : {}),
  };
}

type CoreOrder = Omit<CustomerOrder, 'seller' | 'archived' | 'cookingDate' | 'paid'>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseCoreFields(input: Record<string, unknown>): CoreOrder | null {
  const { id, code, token, firstName, language, fulfilment, note, status, locked } = input;
  const { createdAt, updatedAt } = input;
  const lines = parseArray(input['lines'], parseOrderLine);
  const inbox = parseArray(input['inbox'], parseInboxEntry);
  if (typeof id !== 'string' || typeof code !== 'string' || typeof token !== 'string') return null;
  if (typeof firstName !== 'string' || !isLanguage(language)) return null;
  if (!isOneOf(FULFILMENTS, fulfilment) || !isOneOf(ORDER_STATUSES, status)) return null;
  if (note !== undefined && typeof note !== 'string') return null;
  if (typeof locked !== 'boolean' || !isIsoDate(createdAt) || !isIsoDate(updatedAt)) return null;
  if (!lines || !inbox || inbox.length > INBOX_MAX) return null;
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
    locked,
    inbox,
    createdAt,
    updatedAt,
  };
}

function parseSellerRef(input: unknown): SellerRef | null {
  if (!isRecord(input)) return null;
  const { slug, name } = input;
  return isValidSlug(slug) && typeof name === 'string' ? { slug, name } : null;
}

/** Plan 081: the event of a private order (the customer's view adds `toPayCents`). */
function parsePrivateInfo(input: unknown): PrivateInfo | null {
  if (!isRecord(input) || !isEventDate(input['eventDate'])) return null;
  const { eventTime, depositCents } = input;
  if (eventTime !== undefined && !isEventTime(eventTime)) return null;
  if (depositCents !== undefined && !isInt(depositCents, 0, PRIVATE_MAX_DEPOSIT_CENTS)) return null;
  return {
    eventDate: input['eventDate'],
    ...(eventTime !== undefined ? { eventTime } : {}),
    ...(depositCents !== undefined ? { depositCents } : {}),
  };
}

export function parseCustomerOrder(input: unknown): CustomerOrder | null {
  if (!isRecord(input)) return null;
  const core = parseCoreFields(input);
  const seller = parseSellerRef(input['seller']);
  if (!core || !seller) return null;
  const { archived, cookingDate, pickupPlaceId, collectedAt } = input;
  // Optional so an older server's answer still parses: no `paid` means not paid.
  if (input['paid'] !== undefined && typeof input['paid'] !== 'boolean') return null;
  const paid = input['paid'] === true;
  if (pickupPlaceId !== undefined && (typeof pickupPlaceId !== 'string' || pickupPlaceId === '')) {
    return null;
  }
  if (collectedAt !== undefined && !isIsoDate(collectedAt)) return null;
  const rawState = input['addressState'];
  if (rawState !== undefined && !isOneOf(['saved', 'unreadable'] as const, rawState)) return null;
  const addressState = rawState;
  const rawChange = input['addressChange'];
  if (rawChange !== undefined && !isOneOf(['waiting', 'seen'] as const, rawChange)) return null;
  const addressChange = rawChange;
  let customerPrivate: CustomerOrder['private'];
  if (input['private'] !== undefined) {
    const info = parsePrivateInfo(input['private']);
    const toPay = isRecord(input['private']) ? input['private']['toPayCents'] : undefined;
    if (!info || !isInt(toPay, 0, PRIVATE_MAX_DEPOSIT_CENTS * 10)) return null;
    customerPrivate = { ...info, toPayCents: toPay };
  }
  const extra = {
    ...(customerPrivate ? { private: customerPrivate } : {}),
    ...(addressState !== undefined ? { addressState } : {}),
    ...(addressChange !== undefined ? { addressChange } : {}),
    ...(pickupPlaceId !== undefined ? { pickupPlaceId } : {}),
    ...(collectedAt !== undefined ? { collectedAt } : {}),
  };
  if (archived === undefined && cookingDate === undefined) {
    return { ...core, ...extra, paid, seller };
  }
  if (archived !== true || typeof cookingDate !== 'string' || !DATE.test(cookingDate)) return null;
  return { ...core, ...extra, paid, seller, archived, cookingDate };
}

export function parseExpiredOrder(input: unknown): ExpiredOrder | null {
  if (!isRecord(input)) return null;
  const { archived, expired, token, cookingDate } = input;
  const seller = parseSellerRef(input['seller']);
  if (archived !== true || expired !== true || typeof token !== 'string' || !seller) return null;
  if (typeof cookingDate !== 'string' || !DATE.test(cookingDate)) return null;
  return { archived, expired, token, seller, cookingDate };
}

export function parseFetchedOrderResponse(input: unknown): FetchedOrderResponse | null {
  if (!isRecord(input)) return null;
  if (input['expired'] !== undefined) {
    const expired = parseExpiredOrder(input['expired']);
    return expired ? { expired } : null;
  }
  return parseCustomerOrderResponse(input);
}

export function parseOrder(input: unknown): SellerOrder | null {
  if (!isRecord(input)) return null;
  const base = parseCoreFields(input);
  const { sellerId, paid, waReceived, returning, changed } = input;
  const audit = parseArray(input['audit'], parseAuditEntry);
  if (!base || !audit || audit.length > AUDIT_MAX) return null;
  if (typeof sellerId !== 'string' || sellerId === '') return null;
  if (typeof paid !== 'boolean' || typeof waReceived !== 'boolean') return null;
  if (typeof returning !== 'boolean' || typeof changed !== 'boolean') return null;
  let enteredBy: StaffActor | undefined;
  if (input['enteredBy'] !== undefined) {
    const parsed = parseStaffActor(input['enteredBy']);
    if (!parsed) return null;
    enteredBy = parsed;
  }
  // plan 001 stage 4: all optional, so a backup made before them still parses.
  const { pickupPlaceId, packed, collectedAt, collectedBy } = input;
  if (pickupPlaceId !== undefined && (typeof pickupPlaceId !== 'string' || pickupPlaceId === '')) {
    return null;
  }
  if (packed !== undefined && typeof packed !== 'boolean') return null;
  if (collectedAt !== undefined && !isIsoDate(collectedAt)) return null;
  if (collectedBy !== undefined && !isOneOf(COLLECTED_BY, collectedBy)) return null;
  let customerCode: string | undefined;
  if (input['customerCode'] !== undefined) {
    const parsed = parseCustomerCode(input['customerCode']);
    if (parsed === null) return null;
    customerCode = parsed;
  }
  let address: OrderAddress | undefined;
  if (input['address'] !== undefined) {
    const raw = input['address'];
    if (!isRecord(raw)) return null;
    if (raw['unavailable'] === true) address = { unavailable: true };
    else {
      const parsed = parseDeliveryAddress(raw['address']);
      if (!parsed) return null;
      address = { address: parsed };
    }
  }
  let privateInfo: PrivateInfo | undefined;
  if (input['private'] !== undefined) {
    const parsed = parsePrivateInfo(input['private']);
    if (!parsed) return null;
    privateInfo = parsed;
  }
  return {
    ...base,
    ...(privateInfo ? { private: privateInfo } : {}),
    ...(address ? { address } : {}),
    ...(customerCode !== undefined ? { customerCode } : {}),
    ...(input['confirmed'] === true ? { confirmed: true as const } : {}),
    sellerId,
    paid,
    waReceived,
    returning,
    changed,
    ...(input['addressChanged'] === 'new' || input['addressChanged'] === 'seen'
      ? { addressChanged: input['addressChanged'] }
      : {}),
    ...(enteredBy ? { enteredBy } : {}),
    audit,
    ...(pickupPlaceId !== undefined ? { pickupPlaceId } : {}),
    ...(packed === true ? { packed } : {}),
    ...(collectedAt !== undefined && collectedBy !== undefined ? { collectedAt, collectedBy } : {}),
  };
}

export function parseCustomerOrderResponse(input: unknown): CustomerOrderResponse | null {
  if (!isRecord(input)) return null;
  const order = parseCustomerOrder(input['order']);
  return order ? { order } : null;
}

export function parseCustomerOrdersResponse(input: unknown): CustomerOrdersResponse | null {
  if (!isRecord(input)) return null;
  const orders = parseArray(input['orders'], parseCustomerOrder);
  if (!orders) return null;
  if (input['expired'] === undefined) return { orders };
  const expired = parseArray(input['expired'], parseExpiredOrder);
  return expired ? { orders, expired } : null;
}

export function parseSellerOrderResponse(input: unknown): SellerOrderResponse | null {
  if (!isRecord(input)) return null;
  const order = parseOrder(input['order']);
  return order ? { order } : null;
}

export function parseSellerOrdersResponse(input: unknown): SellerOrdersResponse | null {
  if (!isRecord(input)) return null;
  const orders = parseArray(input['orders'], parseOrder);
  return orders ? { orders } : null;
}
