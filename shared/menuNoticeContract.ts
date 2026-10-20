// New-menu notices (plan 112, D-113). A customer turns on "New menus from <kitchen>" in Settings:
// the kitchen keeps the browser's push endpoint and nothing else (no name, phone or order). The
// owner sees a count and the sends of the current menu, never who listens.
import type { Language } from './domain';
import {
  isPushEndpoint,
  parsePushSubscribeRequest,
  type PushSubscribeRequest,
} from './pushContract';
import { isInt, isIsoDate, isLanguage, isRecord, parseArray } from './parse';

/** Browsers one kitchen keeps; a further one is refused (400) until old ones expire. */
export const MENU_NOTICE_PER_KITCHEN_MAX = 500;
/** A phone that has not ordered from the kitchen for this long stops getting notices (D-113). */
export const MENU_NOTICE_KEEP_DAYS = 183;
/** The third send for the same menu asks first. */
export const MENU_NOTICE_FREE_SENDS = 2;

/** POST /api/s/:slug/menu-notices: turn on, or refresh after an order. */
export type MenuNoticeSubscribeRequest = {
  subscription: PushSubscribeRequest;
  language: Language;
};

/** DELETE /api/s/:slug/menu-notices */
export type MenuNoticeUnsubscribeRequest = { endpoint: string };

export function parseMenuNoticeSubscribeRequest(input: unknown): MenuNoticeSubscribeRequest | null {
  if (!isRecord(input)) return null;
  const subscription = parsePushSubscribeRequest(input['subscription']);
  const language = input['language'];
  return subscription && isLanguage(language) ? { subscription, language } : null;
}

export function parseMenuNoticeUnsubscribeRequest(
  input: unknown,
): MenuNoticeUnsubscribeRequest | null {
  if (!isRecord(input)) return null;
  return isPushEndpoint(input['endpoint']) ? { endpoint: input['endpoint'] } : null;
}

export type MenuNoticeSend = { sentAt: string; reached: number };

/** GET /api/seller/menu-notices (owner). `sends` are those of the current menu, oldest first. */
export type MenuNoticeStatus = {
  phones: number;
  sends: Array<MenuNoticeSend>;
  /** The menu is live and orders are still open. */
  canSend: boolean;
  /** For the preview in the send window: the notice title and the cooking day (YYYY-MM-DD). */
  kitchenName: string;
  cookingDate: string;
};

/** POST /api/seller/menu-notices/send (owner). `again` confirms a third (or later) send. */
export type MenuNoticeSendRequest = { again?: boolean };

export function parseMenuNoticeSendRequest(input: unknown): MenuNoticeSendRequest | null {
  if (input === undefined || input === null) return {};
  if (!isRecord(input)) return null;
  const again = input['again'];
  if (again === undefined) return {};
  return typeof again === 'boolean' ? { again } : null;
}

function parseSend(input: unknown): MenuNoticeSend | null {
  if (!isRecord(input)) return null;
  const { sentAt, reached } = input;
  return isIsoDate(sentAt) && isInt(reached, 0, 1_000_000) ? { sentAt, reached } : null;
}

export function parseMenuNoticeStatus(input: unknown): MenuNoticeStatus | null {
  if (!isRecord(input)) return null;
  const { phones, canSend, kitchenName, cookingDate } = input;
  const sends = parseArray(input['sends'], parseSend);
  if (!isInt(phones, 0, 1_000_000) || typeof canSend !== 'boolean' || !sends) return null;
  if (typeof kitchenName !== 'string' || typeof cookingDate !== 'string') return null;
  return { phones, sends, canSend, kitchenName, cookingDate };
}
