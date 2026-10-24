// Plan 121 part A: the two quiet cards at the top of My orders (notifications, Remember me).
// Per card, on this phone only (localStorage; no storage means the card shows each time):
//  - a cross counts one dismissal and notes what was around: the kitchens' menus and the saved orders;
//  - the card stays quiet until a kitchen's menu changes (its cooking date) or an order is added;
//  - after NUDGE_STOP_AFTER dismissals the card never shows again (Settings still turns each on).
export type NudgeCardId = 'notify' | 'remember';
export const NUDGE_STOP_AFTER = 4;
export const nudgeKey = (id: NudgeCardId): string => `nudge:orders:${id}`;

/** What is around now: each known kitchen's menu (slug to cooking date) and the saved order tokens. */
export type NudgeContext = Readonly<{
  menus: Readonly<Record<string, string>>;
  orders: ReadonlyArray<string>;
}>;

type Stored = Readonly<{ count: number; menus: Record<string, string>; orders: Array<string> }>;
const EMPTY: Stored = { count: 0, menus: {}, orders: [] };

function read(id: NudgeCardId): Stored {
  try {
    const raw = localStorage.getItem(nudgeKey(id));
    if (!raw) return EMPTY;
    const value = JSON.parse(raw) as Record<string, unknown>;
    const menus: Record<string, string> = {};
    if (typeof value['menus'] === 'object' && value['menus'] !== null) {
      for (const [slug, date] of Object.entries(value['menus'])) {
        if (typeof date === 'string') menus[slug] = date;
      }
    }
    const orders = Array.isArray(value['orders'])
      ? value['orders'].filter((token): token is string => typeof token === 'string')
      : [];
    return { count: typeof value['count'] === 'number' ? value['count'] : 0, menus, orders };
  } catch {
    return EMPTY;
  }
}

/** Dismissed four times: never again. */
export const nudgeStopped = (id: NudgeCardId): boolean => read(id).count >= NUDGE_STOP_AFTER;

/**
 * Dismissed and nothing new since: no kitchen's menu changed (a kitchen not noted at the dismissal
 * does not count, so a menu that loads late never wakes the card) and no new order was saved.
 */
export function nudgeQuiet(id: NudgeCardId, now: NudgeContext): boolean {
  const stored = read(id);
  if (stored.count === 0) return false;
  const newMenu = Object.entries(now.menus).some(
    ([slug, date]) => stored.menus[slug] !== undefined && stored.menus[slug] !== date,
  );
  const newOrder = now.orders.some((token) => !stored.orders.includes(token));
  return !newMenu && !newOrder;
}

/** The cross: one more dismissal, quiet until something new. */
export function dismissNudge(id: NudgeCardId, now: NudgeContext): void {
  try {
    const next: Stored = {
      count: read(id).count + 1,
      menus: { ...now.menus },
      orders: [...now.orders],
    };
    localStorage.setItem(nudgeKey(id), JSON.stringify(next));
  } catch {
    // no storage: the card is hidden for this visit only
  }
}
