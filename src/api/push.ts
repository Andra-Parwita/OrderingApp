import {
  parsePublicKeyResponse,
  type PushSubscribeRequest,
  type PushUnsubscribeRequest,
} from '../../shared/pushContract';
import { parseOkResponse } from '../../shared/setupContract';
import { request, type ApiResult } from './http';

// Web push calls for the customer app (plan 004 stage 7). The order's private token is the auth.
// The browser's endpoint and keys go to the server and are never shown or logged here.

/** The server's VAPID public key. A `not_found` failure means push is not set up on this server. */
export async function fetchPublicKey(): Promise<ApiResult<string>> {
  const result = await request('/api/push/public-key', parsePublicKeyResponse);
  return result.ok ? { ok: true, data: result.data.publicKey } : result;
}

/** Subscribes this browser to the order's messages (safe to repeat). */
export async function subscribeOrder(
  token: string,
  subscription: PushSubscribeRequest,
): Promise<ApiResult<true>> {
  const result = await request(`/api/orders/${encodeURIComponent(token)}/push`, parseOkResponse, {
    method: 'POST',
    body: subscription,
  });
  return result.ok ? { ok: true, data: true } : result;
}

/** Stops this browser getting the order's messages. */
export async function unsubscribeOrder(
  token: string,
  endpoint: PushUnsubscribeRequest['endpoint'],
): Promise<ApiResult<true>> {
  const result = await request(`/api/orders/${encodeURIComponent(token)}/push`, parseOkResponse, {
    method: 'DELETE',
    body: { endpoint } satisfies PushUnsubscribeRequest,
  });
  return result.ok ? { ok: true, data: true } : result;
}
