import type { Language } from '../../../shared/domain';
import { subscribeMenuNotice, unsubscribeMenuNotice } from '../../api/menuNotices';
import { currentSubscription, enablePush } from './pushBrowser';

// Plan 112 (D-113): the customer's "New menus from <kitchen>" option. The choice is remembered per
// kitchen on this phone; the server keeps only the browser's endpoint for that kitchen. Turning it
// off never unsubscribes the browser itself: order updates may share the same subscription.

const key = (slug: string) => `menuNotice:${slug}`;

/** Whether this phone turned the notice on for the kitchen. */
export function menuNoticeOn(slug: string): boolean {
  try {
    return localStorage.getItem(key(slug)) === '1';
  } catch {
    return false;
  }
}

function remember(slug: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key(slug), '1');
    else localStorage.removeItem(key(slug));
  } catch {
    // storage unavailable: the switch just shows Off next time
  }
}

export type TurnOnResult = 'ok' | 'blocked' | 'failed';

/** Asks for the browser's permission (call from the tap), subscribes the browser, tells the kitchen. */
export async function turnOnMenuNotice(slug: string, language: Language): Promise<TurnOnResult> {
  if (typeof Notification === 'undefined') return 'failed';
  let permission: NotificationPermission | undefined;
  try {
    permission = await Promise.resolve(Notification.requestPermission());
  } catch {
    permission = undefined;
  }
  if ((permission ?? Notification.permission) !== 'granted') {
    return Notification.permission === 'denied' ? 'blocked' : 'failed';
  }
  if (!(await enablePush([])).ok) return 'failed';
  const subscription = await currentSubscription();
  if (!subscription) return 'failed';
  const sent = await subscribeMenuNotice(slug, { subscription, language });
  if (!sent.ok) return 'failed';
  remember(slug, true);
  return 'ok';
}

/** Tells the kitchen to forget this browser. False when the kitchen could not be reached. */
export async function turnOffMenuNotice(slug: string): Promise<boolean> {
  const subscription = await currentSubscription();
  if (subscription) {
    const removed = await unsubscribeMenuNotice(slug, subscription.endpoint);
    if (!removed.ok) return false;
  }
  remember(slug, false);
  return true;
}

/** After an order: keeps this phone's notice alive (the kitchen drops phones idle for 6 months). */
export async function refreshMenuNotice(slug: string, language: Language): Promise<void> {
  if (!menuNoticeOn(slug)) return;
  try {
    const subscription = await currentSubscription();
    if (subscription) await subscribeMenuNotice(slug, { subscription, language });
  } catch {
    // a missed refresh only makes the notice end a little sooner
  }
}
