import type { KitchenSettings, OrderStatus } from './domain';
import { POST_TEXT_MAX } from './limits';
import { isOneOf, isRecord, parseLocalText } from './parse';
import { normaliseAuMobile } from './phone';
import { ORDER_STATUSES } from './status';

/** POST /api/seller/orders/:code/status; `to` must be in nextStatuses(order). */
export type SetStatusRequest = {
  to: OrderStatus;
  /** D-062: move there although it skips a step or leaves a closed order (`status_out_of_order`). */
  force?: boolean;
};
/** POST /api/seller/orders/:code/paid */
export type SetPaidRequest = { paid: boolean };
/** POST /api/seller/orders/:code/lock */
export type SetLockedRequest = { locked: boolean };
/** POST /api/seller/orders/:code/wa-received */
export type SetWaReceivedRequest = { received: boolean };
/** GET and PUT /api/seller/settings (of the X-Seller seller; PUT replaces all; an empty number removes it). */
export type SettingsResponse = { sellerId: string; settings: KitchenSettings };

export function parseSetStatusRequest(input: unknown): SetStatusRequest | null {
  if (!isRecord(input) || !isOneOf(ORDER_STATUSES, input['to'])) return null;
  if (input['force'] !== undefined && typeof input['force'] !== 'boolean') return null;
  return { to: input['to'], ...(input['force'] !== undefined ? { force: input['force'] } : {}) };
}

/** Optional body of the calls that only need "go ahead anyway" (arriving-soon, nudge). */
export function parseForce(input: unknown): boolean | null {
  if (input === undefined || input === null) return false;
  if (!isRecord(input)) return null;
  if (input['force'] === undefined) return false;
  return typeof input['force'] === 'boolean' ? input['force'] : null;
}

export function parseSetPaidRequest(input: unknown): SetPaidRequest | null {
  if (!isRecord(input) || typeof input['paid'] !== 'boolean') return null;
  return { paid: input['paid'] };
}

export function parseSetLockedRequest(input: unknown): SetLockedRequest | null {
  if (!isRecord(input) || typeof input['locked'] !== 'boolean') return null;
  return { locked: input['locked'] };
}

export function parseSetWaReceivedRequest(input: unknown): SetWaReceivedRequest | null {
  if (!isRecord(input) || typeof input['received'] !== 'boolean') return null;
  return { received: input['received'] };
}

function parsePostText(input: unknown) {
  const text = parseLocalText(input);
  return text && text.en.length <= POST_TEXT_MAX && text.id.length <= POST_TEXT_MAX ? text : null;
}

/** Normalises the number to digits with country code 61; '' or absent removes it. */
export function parseSettingsRequest(input: unknown): KitchenSettings | null {
  if (!isRecord(input)) return null;
  const postGreeting = parsePostText(input['postGreeting']);
  const postClosing = parsePostText(input['postClosing']);
  const { whatsappNumber, orderingOpen } = input;
  if (!postGreeting || !postClosing || typeof orderingOpen !== 'boolean') return null;
  let number: string | undefined;
  if (whatsappNumber !== undefined) {
    if (typeof whatsappNumber !== 'string') return null;
    if (whatsappNumber.trim() !== '') {
      const normalised = normaliseAuMobile(whatsappNumber);
      if (!normalised) return null;
      number = normalised;
    }
  }
  return {
    ...(number !== undefined ? { whatsappNumber: number } : {}),
    postGreeting,
    postClosing,
    orderingOpen,
  };
}

/** Response check (the number is already normalised). */
export function parseSettingsResponse(input: unknown): SettingsResponse | null {
  if (!isRecord(input)) return null;
  const settings = parseSettingsRequest(input['settings']);
  const { sellerId } = input;
  return settings && typeof sellerId === 'string' && sellerId !== ''
    ? { sellerId, settings }
    : null;
}
