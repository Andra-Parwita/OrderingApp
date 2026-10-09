// Applies migrations/*.sql to a D1 database without the wrangler CLI (tests and the seed script).
// It keeps wrangler's own bookkeeping table, so `wrangler d1 migrations apply --local` on the same
// persist directory sees the same migrations as applied.
import { Db, type D1Like } from './d1';

export type Migration = { name: string; sql: string };

/**
 * Splits a migration into single statements. D1's exec() works per line, so a multi-line
 * statement must be prepared whole. A statement ends at a line ending in `;`, except inside a
 * `CREATE TRIGGER ... END;` block, which holds `;` of its own. Full-line `--` comments are dropped.
 */
export function splitStatements(sql: string): Array<string> {
  const statements: Array<string> = [];
  let current: Array<string> = [];
  let inTrigger = false;
  for (const raw of sql.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.trim() === '' || line.trim().startsWith('--')) continue;
    if (current.length === 0 && /^CREATE\s+TRIGGER\b/i.test(line.trim())) inTrigger = true;
    current.push(line);
    const done = inTrigger ? /^END\s*;$/i.test(line.trim()) : line.endsWith(';');
    if (done) {
      statements.push(current.join('\n'));
      current = [];
      inTrigger = false;
    }
  }
  if (current.length > 0) throw new Error('Migration ends in the middle of a statement');
  return statements;
}

const BOOKKEEPING = `CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`;

/** Applies the migrations not applied yet, in name order, each in one transaction. */
export async function applyMigrations(
  d1: D1Like,
  migrations: ReadonlyArray<Migration>,
): Promise<Array<string>> {
  const db = new Db(d1);
  await db.stmt(BOOKKEEPING).run();
  const done = new Set(
    (await db.all<{ name: string }>('SELECT name FROM d1_migrations')).map((row) => row.name),
  );
  const applied: Array<string> = [];
  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
  for (const migration of ordered) {
    if (done.has(migration.name)) continue;
    await db.batch([
      ...splitStatements(migration.sql).map((statement) => db.stmt(statement)),
      db.stmt('INSERT INTO d1_migrations (name) VALUES (?)', migration.name),
    ]);
    applied.push(migration.name);
  }
  return applied;
}
