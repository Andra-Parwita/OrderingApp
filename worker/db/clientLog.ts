// Plan 026: the client error log, a ring of the newest LOG_KEEP entries (migration 0009).
import {
  LOG_KEEP,
  type LogEntry,
  type LogEntryInput,
  type LogQuery,
} from '../../shared/logContract';
import type { Db } from './d1';

const HOUR_MS = 3_600_000;

export type ClientLogRepository = {
  /** Stores the entries, then deletes everything but the newest LOG_KEEP. Also sweeps old rate rows. */
  record(entries: ReadonlyArray<LogEntryInput>): Promise<void>;
  /** Newest first. */
  recent(limit: number): Promise<Array<LogEntry>>;
  /** Newest first, filtered by app and kitchen, one page; `total` counts all that match. */
  list(query: LogQuery, limit: number): Promise<{ entries: Array<LogEntry>; total: number }>;
  /** Deletes every entry. */
  clear(): Promise<void>;
};

type Row = Omit<LogEntry, 'standalone'> & { standalone: number };

export function createClientLogRepository(db: Db, now: () => Date): ClientLogRepository {
  return {
    async record(entries) {
      const at = now().toISOString();
      await db.batch([
        ...entries.map((e) =>
          db.stmt(
            `INSERT INTO client_log (at, app, version, slug, path, kind, code, message, agent, standalone)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            at,
            e.app,
            e.version,
            e.slug,
            e.path,
            e.kind,
            e.code,
            e.message,
            e.agent,
            e.standalone,
          ),
        ),
        db.stmt(
          'DELETE FROM client_log WHERE id NOT IN (SELECT id FROM client_log ORDER BY id DESC LIMIT ?)',
          LOG_KEEP,
        ),
        // The intake limiter keeps a hashed address per client: forget windows over an hour old.
        db.stmt(
          "DELETE FROM auth_rate WHERE scope LIKE 'log:%' AND window_start <= ?",
          new Date(now().getTime() - HOUR_MS).toISOString(),
        ),
      ]);
    },

    async list(query, limit) {
      const where = [...(query.app ? ['app = ?'] : []), ...(query.slug ? ['slug = ?'] : [])];
      const args = [...(query.app ? [query.app] : []), ...(query.slug ? [query.slug] : [])];
      const clause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
      const [rows, count] = await Promise.all([
        db.all<Row>(
          `SELECT * FROM client_log${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
          ...args,
          limit,
          query.offset,
        ),
        db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM client_log${clause}`, ...args),
      ]);
      return {
        entries: rows.map((row) => ({ ...row, standalone: row.standalone === 1 })),
        total: count?.n ?? 0,
      };
    },

    async clear() {
      await db.stmt('DELETE FROM client_log').run();
    },

    async recent(limit) {
      const rows = await db.all<Row>('SELECT * FROM client_log ORDER BY id DESC LIMIT ?', limit);
      return rows.map((row) => ({ ...row, standalone: row.standalone === 1 }));
    },
  };
}
