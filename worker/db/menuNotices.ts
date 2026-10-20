// New-menu notices (plan 112, D-113): per kitchen and browser, never per person or order. The
// endpoint and keys are written and read here and in worker/push/menuNotice.ts only; no route
// returns them and nothing logs them. Every query filters by `seller_id` (D-036).
import type { Language } from '../../shared/domain';
import {
  MENU_NOTICE_PER_KITCHEN_MAX,
  type MenuNoticeSend,
  type MenuNoticeSubscribeRequest,
} from '../../shared/menuNoticeContract';
import type { PushTarget } from '../push/sender';
import type { Db } from './d1';

export type SubscribeOutcome = 'ok' | 'full';

/** Adds this browser for the kitchen, or refreshes it (language, keys, last order time = now). */
export async function subscribeMenuNotice(
  db: Db,
  sellerId: string,
  request: MenuNoticeSubscribeRequest,
  now: Date,
): Promise<SubscribeOutcome> {
  const { subscription, language } = request;
  const known = await db.first<{ n: number }>(
    'SELECT COUNT(*) AS n FROM menu_notice_subscriptions WHERE seller_id = ? AND endpoint = ?',
    sellerId,
    subscription.endpoint,
  );
  if (!known?.n) {
    const count = await db.first<{ n: number }>(
      'SELECT COUNT(*) AS n FROM menu_notice_subscriptions WHERE seller_id = ?',
      sellerId,
    );
    if ((count?.n ?? 0) >= MENU_NOTICE_PER_KITCHEN_MAX) return 'full';
  }
  const at = now.toISOString();
  await db
    .stmt(
      `INSERT INTO menu_notice_subscriptions
         (seller_id, endpoint, p256dh, auth, language, created_at, last_order_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (seller_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh,
         auth = excluded.auth, language = excluded.language, last_order_at = excluded.last_order_at`,
      sellerId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      language,
      at,
      at,
    )
    .run();
  return 'ok';
}

export async function unsubscribeMenuNotice(
  db: Db,
  sellerId: string,
  endpoint: string,
): Promise<void> {
  await db
    .stmt(
      'DELETE FROM menu_notice_subscriptions WHERE seller_id = ? AND endpoint = ?',
      sellerId,
      endpoint,
    )
    .run();
}

/** The seller's menu as a notice needs it; undefined when there is no menu row. */
export type NoticeMenu = {
  id: string;
  live: boolean;
  takingOrders: boolean;
  cookingDate: string;
  cutoffAt: string;
  kitchenName: string;
  slug: string;
};

export async function readNoticeMenu(db: Db, sellerId: string): Promise<NoticeMenu | undefined> {
  const row = await db.first<{
    id: string;
    state: string;
    taking_orders: number;
    cooking_date: string;
    cutoff_at: string;
    name: string;
    slug: string;
  }>(
    `SELECT m.id, m.state, m.taking_orders, m.cooking_date, m.cutoff_at, s.name, s.slug
     FROM menus m JOIN sellers s ON s.id = m.seller_id WHERE m.seller_id = ?`,
    sellerId,
  );
  return row
    ? {
        id: row.id,
        live: row.state === 'live',
        takingOrders: row.taking_orders === 1,
        cookingDate: row.cooking_date,
        cutoffAt: row.cutoff_at,
        kitchenName: row.name,
        slug: row.slug,
      }
    : undefined;
}

export async function countNoticePhones(db: Db, sellerId: string): Promise<number> {
  const row = await db.first<{ n: number }>(
    'SELECT COUNT(*) AS n FROM menu_notice_subscriptions WHERE seller_id = ?',
    sellerId,
  );
  return row?.n ?? 0;
}

export async function readNoticeSends(
  db: Db,
  sellerId: string,
  menuId: string,
): Promise<Array<MenuNoticeSend>> {
  const rows = await db.all<{ sent_at: string; reached: number }>(
    'SELECT sent_at, reached FROM menu_notice_sends WHERE seller_id = ? AND menu_id = ? ORDER BY sent_at',
    sellerId,
    menuId,
  );
  return rows.map((row) => ({ sentAt: row.sent_at, reached: row.reached }));
}

export type NoticeTarget = PushTarget & { language: Language };

/** Every browser of the kitchen; none when an admin paused it fully (as for order pushes). */
export async function readNoticeTargets(db: Db, sellerId: string): Promise<Array<NoticeTarget>> {
  const rows = await db.all<{ endpoint: string; p256dh: string; auth: string; language: string }>(
    `SELECT endpoint, p256dh, auth, language FROM menu_notice_subscriptions
     WHERE seller_id = ? AND seller_id NOT IN (SELECT id FROM sellers WHERE paused = 'full')`,
    sellerId,
  );
  return rows.map((row) => ({
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    language: row.language === 'id' ? 'id' : 'en',
  }));
}

export async function dropNoticeEndpoints(
  db: Db,
  sellerId: string,
  endpoints: ReadonlyArray<string>,
): Promise<void> {
  for (let from = 0; from < endpoints.length; from += 50) {
    await db.batch(
      endpoints
        .slice(from, from + 50)
        .map((endpoint) =>
          db.stmt(
            'DELETE FROM menu_notice_subscriptions WHERE seller_id = ? AND endpoint = ?',
            sellerId,
            endpoint,
          ),
        ),
    );
  }
}

export async function recordNoticeSend(
  db: Db,
  sellerId: string,
  menuId: string,
  sentAt: Date,
  reached: number,
): Promise<void> {
  await db
    .stmt(
      'INSERT INTO menu_notice_sends (seller_id, menu_id, sent_at, reached) VALUES (?, ?, ?, ?)',
      sellerId,
      menuId,
      sentAt.toISOString(),
      reached,
    )
    .run();
}
