import type { Order } from '../../../shared/domain';

export const MY_ORDERS_KEY = 'myOrders';

export type SavedOrder = Readonly<{ code: string; token: string; placedAt: string }>;

function isSavedOrder(entry: unknown): entry is SavedOrder {
  if (typeof entry !== 'object' || entry === null) return false;
  const { code, token, placedAt } = entry as Record<string, unknown>;
  return typeof code === 'string' && typeof token === 'string' && typeof placedAt === 'string';
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

/** "My orders" lives on this phone only: the code, the private token and when it was placed. */
export function saveMyOrder(order: Order): void {
  try {
    const others = readMyOrders().filter((entry) => entry.token !== order.token);
    const saved: SavedOrder = { code: order.code, token: order.token, placedAt: order.createdAt };
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify([saved, ...others]));
  } catch {
    // storage unavailable: the order is still placed, just not remembered on this phone
  }
}
