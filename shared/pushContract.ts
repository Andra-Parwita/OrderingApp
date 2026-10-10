// Web push (plan 004 stage 6). Subscriptions belong to an order, reached by its private token; the
// browser's endpoint and keys are secrets: no route returns them and nothing logs them.
import { isRecord } from './parse';

/** GET /api/push/public-key */
export type PublicKeyResponse = { publicKey: string };

/** POST /api/orders/:token/push: the browser's `PushSubscription.toJSON()`. */
export type PushSubscribeRequest = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** DELETE /api/orders/:token/push */
export type PushUnsubscribeRequest = { endpoint: string };

export const PUSH_ENDPOINT_MAX = 1024;
export const PUSH_KEY_MAX = 128;
/** Browsers per order (a phone, a laptop and a spare). */
export const PUSH_PER_ORDER_MAX = 5;

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** An https URL no longer than the cap. */
export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > PUSH_ENDPOINT_MAX) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= PUSH_KEY_MAX && BASE64URL.test(value);
}

export function parsePushSubscribeRequest(input: unknown): PushSubscribeRequest | null {
  if (!isRecord(input)) return null;
  const { endpoint, keys } = input;
  if (!isPushEndpoint(endpoint) || !isRecord(keys)) return null;
  const { p256dh, auth } = keys;
  return isKey(p256dh) && isKey(auth) ? { endpoint, keys: { p256dh, auth } } : null;
}

export function parsePushUnsubscribeRequest(input: unknown): PushUnsubscribeRequest | null {
  if (!isRecord(input)) return null;
  return isPushEndpoint(input['endpoint']) ? { endpoint: input['endpoint'] } : null;
}

export function parsePublicKeyResponse(input: unknown): PublicKeyResponse | null {
  if (!isRecord(input)) return null;
  const { publicKey } = input;
  return typeof publicKey === 'string' && publicKey !== '' ? { publicKey } : null;
}

/** What the service worker receives (JSON in the push body). */
export type PushPayload = {
  title: string;
  body: string;
  icon: string;
  data: { url: string };
};
