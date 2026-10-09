// Push subscriptions of one seller's orders (plan 004 stage 6). A subscription belongs to an order,
// never to a person or a phone (D-059). Every query filters by `seller_id` (D-036). The endpoint and
// keys are written and read here and in worker/push/dispatch.ts only.
import type { ApiErrorCode } from '../../shared/apiError';
import { PUSH_PER_ORDER_MAX } from '../../shared/pushContract';
import type { SellerRepository, StoreResult } from '../repo/Repository';
import type { Db } from './d1';

export type PushOps = Pick<SellerRepository, 'subscribePush' | 'unsubscribePush'>;

const fail = (error: ApiErrorCode, message: string): StoreResult<true> => ({
  ok: false,
  error,
  message,
});

export function createPushOps(db: Db, now: () => Date, sid: string): PushOps {
  const liveOrderId = async (token: string): Promise<string | undefined> =>
    (
      await db.first<{ id: string }>(
        'SELECT id FROM orders WHERE seller_id = ? AND token = ? AND past_week_id IS NULL',
        sid,
        token,
      )
    )?.id;

  return {
    async subscribePush(token, request) {
      const orderId = await liveOrderId(token);
      if (!orderId) return fail('not_found', 'Order not found');
      const existing = await db.all<{ endpoint: string }>(
        'SELECT endpoint FROM push_subscriptions WHERE seller_id = ? AND order_id = ?',
        sid,
        orderId,
      );
      const known = existing.some((row) => row.endpoint === request.endpoint);
      if (!known && existing.length >= PUSH_PER_ORDER_MAX) {
        return fail('invalid_request', 'Too many devices for this order');
      }
      await db
        .stmt(
          `INSERT INTO push_subscriptions (seller_id, order_id, endpoint, p256dh, auth, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (seller_id, order_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
          sid,
          orderId,
          request.endpoint,
          request.keys.p256dh,
          request.keys.auth,
          now().toISOString(),
        )
        .run();
      return { ok: true, value: true };
    },

    async unsubscribePush(token, endpoint) {
      const orderId = await liveOrderId(token);
      if (!orderId) return fail('not_found', 'Order not found');
      await db
        .stmt(
          'DELETE FROM push_subscriptions WHERE seller_id = ? AND order_id = ? AND endpoint = ?',
          sid,
          orderId,
          endpoint,
        )
        .run();
      return { ok: true, value: true };
    },
  };
}
