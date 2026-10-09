// The words of a push notification, in both languages. They repeat the customer inbox texts
// (src/features/customer-orders/i18n, keys `inbox.*`); shared/pushText.test.ts fails if they drift.
import type { InboxEntry, Language, OrderStatus } from './domain';

type Texts = {
  readyIn: string;
  ready: string;
  arrived: string;
  arrivingIn: string;
  arrivingSoon: string;
  outForDelivery: string;
  delivered: string;
  collected: string;
  other: string;
  status: Record<OrderStatus, string>;
};

export const PUSH_TEXTS: Record<Language, Texts> = {
  en: {
    readyIn: 'Ready in {{minutes}} min',
    ready: 'Ready for pickup',
    arrived: 'The seller has arrived at the pickup point.',
    arrivingIn: 'Arriving in {{minutes}} min',
    arrivingSoon: 'Arriving soon',
    outForDelivery: 'Out for delivery',
    delivered: 'Delivered',
    collected: 'Collected',
    other: 'Update from the seller',
    status: {
      ordered: 'Order placed',
      confirmed: 'Your order is confirmed',
      ready_for_pickup: 'Ready for pickup',
      out_for_delivery: 'Out for delivery',
      collected: 'Collected',
      delivered: 'Delivered',
      cancelled: 'Order cancelled',
    },
  },
  id: {
    readyIn: 'Siap dalam {{minutes}} menit',
    ready: 'Siap diambil',
    arrived: 'Penjual sudah tiba di tempat pengambilan.',
    arrivingIn: 'Tiba dalam {{minutes}} menit',
    arrivingSoon: 'Segera tiba',
    outForDelivery: 'Sedang diantar',
    delivered: 'Sudah diterima',
    collected: 'Sudah diambil',
    other: 'Kabar dari penjual',
    status: {
      ordered: 'Pesanan diterima',
      confirmed: 'Pesanan Anda dikonfirmasi',
      ready_for_pickup: 'Siap diambil',
      out_for_delivery: 'Sedang diantar',
      collected: 'Sudah diambil',
      delivered: 'Sudah diantar',
      cancelled: 'Pesanan dibatalkan',
    },
  },
};

const MESSAGE_KEYS = [
  'readyIn',
  'ready',
  'arrived',
  'arrivingIn',
  'arrivingSoon',
  'outForDelivery',
  'delivered',
  'collected',
] as const;
type MessageKey = (typeof MESSAGE_KEYS)[number];
const isMessageKey = (key: string): key is MessageKey =>
  (MESSAGE_KEYS as ReadonlyArray<string>).includes(key);

/** The notification body for one inbox entry, or undefined when it is not worth a push. */
export function pushBodyOf(entry: InboxEntry, language: Language): string | undefined {
  const texts = PUSH_TEXTS[language];
  if (entry.kind === 'nudge') return undefined;
  if (entry.kind === 'status') {
    // "Order placed" is the customer's own action: no push.
    return entry.status === undefined || entry.status === 'ordered'
      ? undefined
      : texts.status[entry.status];
  }
  if (entry.text !== undefined && entry.text !== '') return entry.text;
  // `readyAt` names a place; a push keeps to the plain "Ready for pickup".
  const key = entry.textKey === 'readyAt' ? 'ready' : entry.textKey;
  const template = key !== undefined && isMessageKey(key) ? texts[key] : texts.other;
  return template.replace('{{minutes}}', String(entry.minutes ?? ''));
}

/**
 * The one entry a push says for a set of entries an operation added: the seller's message wins over
 * a status line (a "Ready in 10 min" with "Confirmed" tells the customer more); otherwise the newest.
 */
export function pushEntryOf(entries: ReadonlyArray<InboxEntry>): InboxEntry | undefined {
  const worth = entries.filter((entry) => pushBodyOf(entry, 'en') !== undefined);
  return worth.find((entry) => entry.kind === 'message') ?? worth[worth.length - 1];
}
