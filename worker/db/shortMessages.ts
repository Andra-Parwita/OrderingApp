// Plan 086 (D-106): the admin's short messages (table short_messages).
import {
  MESSAGE_LIST_MAX,
  type MessageRequest,
  type ShortMessage,
} from '../../shared/shortMessage';
import type { Db } from './d1';

type Row = {
  id: string;
  text_en: string;
  text_id: string;
  audience: ShortMessage['audience'];
  seller_ids: string | null;
  created_at: string;
  expires_at: string;
  stopped_at: string | null;
};

export type ShortMessageRepository = {
  /** Stores a message; `expiry` gets the repository's clock and answers when it ends (ISO). */
  create(input: MessageRequest, expiry: (now: Date) => string): Promise<ShortMessage>;
  /** The newest few, newest first. */
  recent(): Promise<Array<ShortMessage>>;
  /** Not stopped and not expired now. */
  active(): Promise<Array<ShortMessage>>;
  /** Ends it now; false when there is no such message. */
  stop(id: string): Promise<boolean>;
};

function ofRow(row: Row): ShortMessage {
  let ids: Array<string> | null = null;
  if (row.seller_ids !== null) {
    try {
      const parsed: unknown = JSON.parse(row.seller_ids);
      ids = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      ids = [];
    }
  }
  return {
    id: row.id,
    textEn: row.text_en,
    textId: row.text_id,
    audience: row.audience,
    sellerIds: ids,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    stoppedAt: row.stopped_at,
  };
}

const COLUMNS =
  'id, text_en, text_id, audience, seller_ids, created_at, expires_at, stopped_at FROM short_messages';

export function createShortMessageRepository(
  db: Db,
  now: () => Date,
  newId: () => string,
): ShortMessageRepository {
  return {
    async create(input, expiry) {
      const id = newId();
      const sent = now();
      const createdAt = sent.toISOString();
      const expiresAt = expiry(sent);
      await db
        .stmt(
          `INSERT INTO short_messages (id, text_en, text_id, audience, seller_ids, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          id,
          input.textEn,
          input.textId,
          input.audience,
          input.sellerIds === null ? null : JSON.stringify(input.sellerIds),
          createdAt,
          expiresAt,
        )
        .run();
      return {
        id,
        textEn: input.textEn,
        textId: input.textId,
        audience: input.audience,
        sellerIds: input.sellerIds,
        createdAt,
        expiresAt,
        stoppedAt: null,
      };
    },
    async recent() {
      const rows = await db.all<Row>(
        `SELECT ${COLUMNS} ORDER BY created_at DESC, id LIMIT ?`,
        MESSAGE_LIST_MAX,
      );
      return rows.map(ofRow);
    },
    async active() {
      const rows = await db.all<Row>(
        `SELECT ${COLUMNS} WHERE stopped_at IS NULL AND expires_at > ? ORDER BY created_at DESC`,
        now().toISOString(),
      );
      return rows.map(ofRow);
    },
    async stop(id) {
      const found = await db.first<{ id: string }>(
        'SELECT id FROM short_messages WHERE id = ?',
        id,
      );
      if (!found) return false;
      await db
        .stmt(
          'UPDATE short_messages SET stopped_at = ? WHERE id = ? AND stopped_at IS NULL',
          now().toISOString(),
          id,
        )
        .run();
      return true;
    },
  };
}
