import type { PushSubscribeRequest } from '../../../shared/pushContract';
import { fetchPublicKey, subscribeOrder, unsubscribeOrder } from '../../api/push';
import type { ApiResult } from '../../api/http';
import { registerServiceWorker } from './registerServiceWorker';

// The browser side of web push (plan 004 stage 7): subscribe this browser and tell the server for
// each order, or undo it. The permission itself is asked for by the caller, from a tap, before this
// runs. Browser and network calls come in through `PushDeps` so the logic is testable.

export type BrowserSubscription = Readonly<{
  endpoint: string;
  toJSON(): { endpoint?: string; keys?: Record<string, string> };
  unsubscribe(): Promise<boolean>;
}>;

export type PushRegistration = Readonly<{
  pushManager: Readonly<{
    getSubscription(): Promise<BrowserSubscription | null>;
    subscribe(options: {
      userVisibleOnly: boolean;
      applicationServerKey: BufferSource;
    }): Promise<BrowserSubscription>;
  }>;
}>;

export type PushDeps = Readonly<{
  fetchPublicKey: () => Promise<ApiResult<string>>;
  subscribeOrder: (token: string, body: PushSubscribeRequest) => Promise<ApiResult<true>>;
  unsubscribeOrder: (token: string, endpoint: string) => Promise<ApiResult<true>>;
  /** The service worker registration, registering it first when the page has none yet. */
  getRegistration: () => Promise<PushRegistration>;
  /** The registration if there is one; never registers. */
  peekRegistration: () => Promise<PushRegistration | null>;
}>;

export const browserPushDeps: PushDeps = {
  fetchPublicKey,
  subscribeOrder,
  unsubscribeOrder,
  async getRegistration() {
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) await registerServiceWorker({ force: true });
    // `ready` waits for the worker to be active, which a push subscription needs.
    return await navigator.serviceWorker.ready;
  },
  async peekRegistration() {
    const existing = await navigator.serviceWorker.getRegistration();
    return (existing as unknown as PushRegistration | undefined) ?? null;
  },
};

/** The VAPID key as the bytes `pushManager.subscribe` wants. */
export function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type EnableResult = { ok: true } | { ok: false; reason: 'not-set-up' | 'failed' };

function toRequest(subscription: BrowserSubscription): PushSubscribeRequest | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.['p256dh'];
  const auth = json.keys?.['auth'];
  return json.endpoint && p256dh && auth
    ? { endpoint: json.endpoint, keys: { p256dh, auth } }
    : null;
}

/**
 * Subscribes this browser (reusing a subscription it already has) and sends it to the server for
 * each order. Ok when at least one order took it, or when there are no orders yet.
 */
export async function enablePush(
  tokens: ReadonlyArray<string>,
  deps: PushDeps = browserPushDeps,
): Promise<EnableResult> {
  const key = await deps.fetchPublicKey();
  // 404: this server has no push keys (the placeholder keys count as none).
  if (!key.ok) return { ok: false, reason: key.error === 'not_found' ? 'not-set-up' : 'failed' };
  try {
    const registration = await deps.getRegistration();
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(key.data),
      }));
    const body = toRequest(subscription);
    if (!body) return { ok: false, reason: 'failed' };
    const results = await Promise.all(tokens.map((token) => deps.subscribeOrder(token, body)));
    return tokens.length === 0 || results.some((result) => result.ok)
      ? { ok: true }
      : { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Stops the messages for these orders and drops this browser's subscription. */
export async function disablePush(
  tokens: ReadonlyArray<string>,
  deps: PushDeps = browserPushDeps,
): Promise<boolean> {
  try {
    const registration = await deps.peekRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return true;
    await Promise.all(tokens.map((token) => deps.unsubscribeOrder(token, subscription.endpoint)));
    await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

/**
 * This browser's push subscription as the server needs it, or null when it has none. It only looks:
 * no prompt, no network, and it does not register the service worker.
 */
export async function currentSubscription(
  deps: PushDeps = browserPushDeps,
): Promise<PushSubscribeRequest | null> {
  try {
    const registration = await deps.peekRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? toRequest(subscription) : null;
  } catch {
    return null;
  }
}
