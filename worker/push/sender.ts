// Sending one web push (RFC 8030, 8291, 8292) with @block65/webcrypto-web-push, which uses only
// WebCrypto and fetch, so it runs on Workers. Nothing here logs: an endpoint and its keys are the
// customer's browser's secrets.
import { buildPushPayload, type VapidKeys } from '@block65/webcrypto-web-push';
import type { PushPayload } from '../../shared/pushContract';

/** The browser's subscription as stored. */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Sends one notification and returns the push service's HTTP status. Throws on a network error. */
export type PushSender = (target: PushTarget, payload: PushPayload) => Promise<number>;

/** A message is worth delivering for half a day, then the customer has moved on. */
const TTL_SECONDS = 12 * 60 * 60;

/** A value that is empty or still the `replace-…` placeholder from an example file counts as unset. */
export function realVapidValue(value: string | undefined): string | undefined {
  return !value || value.startsWith('replace-') ? undefined : value;
}

/** The VAPID keys from the Worker's env, or undefined when push is not set up. */
export function vapidFromEnv(env: {
  VAPID_PUBLIC_KEY?: string | undefined;
  VAPID_PRIVATE_KEY?: string | undefined;
  VAPID_SUBJECT?: string | undefined;
}): VapidKeys | undefined {
  const publicKey = realVapidValue(env.VAPID_PUBLIC_KEY);
  const privateKey = realVapidValue(env.VAPID_PRIVATE_KEY);
  const subject = realVapidValue(env.VAPID_SUBJECT);
  if (!publicKey || !privateKey || !subject) return undefined;
  return { publicKey, privateKey, subject };
}

export function createWebPushSender(vapid: VapidKeys): PushSender {
  return async (target, payload) => {
    const request = await buildPushPayload(
      { data: payload, options: { ttl: TTL_SECONDS, urgency: 'high' } },
      {
        endpoint: target.endpoint,
        expirationTime: null,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      vapid,
    );
    const response = await fetch(target.endpoint, request);
    return response.status;
  };
}
