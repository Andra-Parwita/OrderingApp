import type { CustomerOrder, OrderStatus } from '../../../shared/domain';
import { rememberKitchen } from './lastKitchen';

// "My orders" lives on this phone only (D-007/D-010): the code, the private token and a little
// state so the list can show an unseen-update dot and a returning customer can be recognised.
export const MY_ORDERS_KEY = 'myOrders';

export type SavedOrder = Readonly<{
  code: string;
  token: string;
  placedAt: string;
  /** The seller the order belongs to; entries saved before many sellers get it when next fetched. */
  sellerSlug?: string;
  /** The last status this phone saw; collected/delivered marks a returning customer. */
  lastStatus?: OrderStatus;
  /** ISO time of the newest inbox entry the customer has seen. */
  lastSeenInboxAt?: string;
}>;

function isSavedOrder(entry: unknown): entry is SavedOrder {
  if (typeof entry !== 'object' || entry === null) return false;
  const { code, token, placedAt, sellerSlug, lastStatus, lastSeenInboxAt } = entry as Record<
    string,
    unknown
  >;
  return (
    typeof code === 'string' &&
    typeof token === 'string' &&
    typeof placedAt === 'string' &&
    (sellerSlug === undefined || typeof sellerSlug === 'string') &&
    (lastStatus === undefined || typeof lastStatus === 'string') &&
    (lastSeenInboxAt === undefined || typeof lastSeenInboxAt === 'string')
  );
}

export function readMyOrders(): Array<SavedOrder> {
  try {
    const raw = localStorage.getItem(MY_ORDERS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSavedOrder) : [];
  } catch {
    return [];
  }
}

function writeMyOrders(entries: ReadonlyArray<SavedOrder>): void {
  try {
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable: the order still exists, it is just not remembered on this phone
  }
}

/** ISO time of the newest inbox entry, or undefined when the inbox is empty. */
export function newestInboxAt(order: CustomerOrder): string | undefined {
  let newest: string | undefined;
  for (const entry of order.inbox) {
    if (newest === undefined || Date.parse(entry.at) > Date.parse(newest)) newest = entry.at;
  }
  return newest;
}

/**
 * Adds the order (newest first) or refreshes it. Keeps what this phone already knew; a new entry
 * counts everything in the inbox as seen (the customer is looking at the order right now).
 */
export function saveMyOrder(order: CustomerOrder): void {
  const entries = readMyOrders();
  const existing = entries.find((entry) => entry.token === order.token);
  const seen = existing?.lastSeenInboxAt ?? newestInboxAt(order);
  const saved: SavedOrder = {
    code: order.code,
    token: order.token,
    placedAt: existing?.placedAt ?? order.createdAt,
    sellerSlug: order.seller.slug,
    lastStatus: order.status,
    ...(seen !== undefined ? { lastSeenInboxAt: seen } : {}),
  };
  const others = entries.filter((entry) => entry.token !== order.token);
  rememberKitchen(order.seller.slug);
  writeMyOrders(
    existing ? entries.map((e) => (e.token === order.token ? saved : e)) : [saved, ...others],
  );
}

/** Remembers the latest status (for the returning check) without touching the seen marker. */
export function rememberStatus(order: CustomerOrder): void {
  const entries = readMyOrders();
  if (!entries.some((entry) => entry.token === order.token)) {
    // Opened from a link the seller sent (D-010): add it, with nothing marked seen yet.
    rememberKitchen(order.seller.slug);
    writeMyOrders([
      {
        code: order.code,
        token: order.token,
        placedAt: order.createdAt,
        sellerSlug: order.seller.slug,
        lastStatus: order.status,
      },
      ...entries,
    ]);
    return;
  }
  // Also fills the seller of an entry saved before many sellers existed.
  writeMyOrders(
    entries.map((entry) =>
      entry.token === order.token
        ? { ...entry, sellerSlug: order.seller.slug, lastStatus: order.status }
        : entry,
    ),
  );
}

/** The customer has viewed the order: everything up to its newest inbox entry is seen. */
export function markInboxSeen(order: CustomerOrder): void {
  const newest = newestInboxAt(order);
  if (newest === undefined) return;
  const entries = readMyOrders();
  if (!entries.some((entry) => entry.token === order.token)) return;
  writeMyOrders(
    entries.map((entry) =>
      entry.token === order.token ? { ...entry, lastSeenInboxAt: newest } : entry,
    ),
  );
}

/** True when the newest inbox entry is newer than the last one the customer saw. */
export function hasUnseenUpdate(order: CustomerOrder, saved: SavedOrder | undefined): boolean {
  const newest = newestInboxAt(order);
  if (newest === undefined) return false;
  if (saved?.lastSeenInboxAt === undefined) return true;
  return Date.parse(newest) > Date.parse(saved.lastSeenInboxAt);
}

/**
 * A returning customer of this seller: this phone holds an order of theirs that was collected or
 * delivered. An entry not yet matched to a seller (saved before many sellers) counts for any.
 */
export function isReturningCustomer(
  sellerSlug: string,
  entries: ReadonlyArray<SavedOrder> = readMyOrders(),
): boolean {
  return entries.some(
    (entry) =>
      (entry.lastStatus === 'collected' || entry.lastStatus === 'delivered') &&
      (entry.sellerSlug === undefined || entry.sellerSlug === sellerSlug),
  );
}
