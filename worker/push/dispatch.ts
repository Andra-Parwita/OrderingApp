// Turns "the seller told these orders something" into web pushes, after the D1 write is done (never
// inside it). The repository calls `collect` as each write finishes; the Worker calls `flush` once
// the answer is ready, inside `ctx.waitUntil`, so the seller's response is not slowed.
//
// D1 budget: one read of the subscriptions for all affected orders (chunked under the 100 bound
// values limit), one batch for the dead ones. Logs hold counts only: never an endpoint, a key, a
// token or a name.
import type { InboxEntry, SellerOrder } from '../../shared/domain';
import { iconPath } from '../../shared/kitchenManifest';
import type { PushPayload } from '../../shared/pushContract';
import { pushBodyOf, pushEntryOf } from '../../shared/pushText';
import { marks, type Db } from '../db/d1';
import type { PushSender, PushTarget } from './sender';

/** One order the seller changed, with the inbox entries the change added (oldest first). */
export type CustomerChange = {
  sellerId: string;
  slug: string;
  /** The kitchen name: the notification title. */
  kitchenName: string;
  order: SellerOrder;
  entries: Array<InboxEntry>;
};

export type PushDispatcher = {
  collect: (changes: ReadonlyArray<CustomerChange>) => void;
  /** Sends what was collected. Never throws. */
  flush: () => Promise<void>;
};

type SubRow = {
  seller_id: string;
  order_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Sends in small parallel groups so a big place does not open hundreds of connections at once. */
const PARALLEL = 10;
/** Orders per subscriptions read: 1 seller id + 90 order ids stays under D1's 100 bound values. */
const READ_CHUNK = 90;

const consoleLog = (line: string): void => {
  console.log(line);
};

export function createPushDispatcher(options: {
  db: Db;
  /** Absent when push is not configured: nothing is sent, cancelled orders are still cleaned up. */
  sender?: PushSender | undefined;
  log?: (line: string) => void;
}): PushDispatcher {
  const { db, sender } = options;
  const log = options.log ?? consoleLog;
  let pending: Array<CustomerChange> = [];

  async function readSubscriptions(changes: Array<CustomerChange>): Promise<Array<SubRow>> {
    const bySeller = new Map<string, Array<string>>();
    for (const change of changes) {
      const ids = bySeller.get(change.sellerId) ?? [];
      ids.push(change.order.id);
      bySeller.set(change.sellerId, ids);
    }
    const rows: Array<SubRow> = [];
    for (const [sellerId, ids] of bySeller) {
      for (let from = 0; from < ids.length; from += READ_CHUNK) {
        const group = ids.slice(from, from + READ_CHUNK);
        rows.push(
          ...(await db.all<SubRow>(
            `SELECT seller_id, order_id, endpoint, p256dh, auth FROM push_subscriptions
             WHERE seller_id = ? AND order_id IN (${marks(group.length)})`,
            sellerId,
            ...group,
          )),
        );
      }
    }
    return rows;
  }

  async function run(changes: Array<CustomerChange>): Promise<void> {
    const sends: Array<{ row: SubRow; payload: PushPayload }> = [];
    if (sender) {
      const wanted = changes.filter((change) => {
        const entry = pushEntryOf(change.entries);
        return entry !== undefined;
      });
      const rows = wanted.length > 0 ? await readSubscriptions(wanted) : [];
      const byOrder = new Map<string, Array<SubRow>>();
      for (const row of rows) {
        const key = `${row.seller_id}/${row.order_id}`;
        byOrder.set(key, [...(byOrder.get(key) ?? []), row]);
      }
      for (const change of wanted) {
        const entry = pushEntryOf(change.entries);
        const body = entry ? pushBodyOf(entry, change.order.language) : undefined;
        if (body === undefined) continue;
        const payload: PushPayload = {
          title: change.kitchenName,
          body,
          icon: iconPath(change.slug, 192),
          data: { url: `/o/${change.order.token}` },
        };
        for (const row of byOrder.get(`${change.sellerId}/${change.order.id}`) ?? []) {
          sends.push({ row, payload });
        }
      }
    }

    const dead: Array<SubRow> = [];
    let sent = 0;
    let failed = 0;
    for (let from = 0; from < sends.length; from += PARALLEL) {
      const group = sends.slice(from, from + PARALLEL);
      const outcomes = await Promise.allSettled(
        group.map(({ row, payload }): Promise<number> => {
          const target: PushTarget = { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth };
          return (sender as PushSender)(target, payload);
        }),
      );
      outcomes.forEach((outcome, index) => {
        const row = group[index]?.row;
        if (outcome.status === 'rejected') failed += 1;
        else if (outcome.value === 404 || outcome.value === 410) {
          if (row) dead.push(row);
        } else if (outcome.value >= 200 && outcome.value < 300) sent += 1;
        else failed += 1;
      });
    }

    const statements = [
      ...dead.map((row) =>
        db.stmt(
          'DELETE FROM push_subscriptions WHERE seller_id = ? AND order_id = ? AND endpoint = ?',
          row.seller_id,
          row.order_id,
          row.endpoint,
        ),
      ),
      // A cancelled order has nothing more to say: its subscriptions go once the news is out.
      ...changes
        .filter((change) => change.order.status === 'cancelled')
        .map((change) =>
          db.stmt(
            'DELETE FROM push_subscriptions WHERE seller_id = ? AND order_id = ?',
            change.sellerId,
            change.order.id,
          ),
        ),
    ];
    for (let from = 0; from < statements.length; from += 50) {
      await db.batch(statements.slice(from, from + 50));
    }
    if (sends.length > 0) {
      log(`push: ${String(sent)} sent, ${String(dead.length)} expired, ${String(failed)} failed`);
    }
  }

  return {
    collect(changes) {
      pending.push(...changes);
    },
    async flush() {
      const changes = pending;
      pending = [];
      if (changes.length === 0) return;
      try {
        await run(changes);
      } catch {
        // A missed push is not worth failing anything; the order page shows the same news.
        log('push: dispatch failed');
      }
    },
  };
}
