// Cheap resets for the test database (stage 8.4a). Wiping and re-seeding every table takes about
// 135 ms; a test usually writes to two or three tables. This wraps the D1 binding, notes which
// tables a test wrote to, and puts back only those (plus the tables that point at them), so the
// database is exactly as a full reset leaves it. Anything it cannot read falls back to a full reset.
import type { D1Like, D1Statement } from '../worker/db/d1';
import { Db } from '../worker/db/d1';
import { fixtureStatements, TABLES_CHILDREN_FIRST, wipeAndSeed } from '../worker/db/seed';

const WRITE =
  /^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM)\s+["`]?(\w+)/i;
const READ = /^\s*(?:SELECT|PRAGMA)\b/i;

class Tracked implements D1Statement {
  constructor(
    readonly inner: D1Statement,
    readonly sql: string,
  ) {}
  bind(...values: Array<unknown>): D1Statement {
    return new Tracked(this.inner.bind(...values), this.sql);
  }
  first<T = unknown>(): Promise<T | null> {
    return this.inner.first<T>();
  }
  all<T = unknown>(): Promise<{ results: Array<T> }> {
    return this.inner.all<T>();
  }
  run(): Promise<unknown> {
    return this.inner.run();
  }
}

/** For each table, the tables that hold a foreign key to it (they go with it on a reset). */
function childrenOf(migrations: ReadonlyArray<string>): Map<string, Set<string>> {
  const children = new Map<string, Set<string>>();
  for (const sql of migrations) {
    for (const block of sql.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\)/g)) {
      const child = block[1] as string;
      for (const reference of (block[2] as string).matchAll(/REFERENCES\s+(\w+)/g)) {
        const parent = reference[1] as string;
        (children.get(parent) ?? children.set(parent, new Set()).get(parent))?.add(child);
      }
    }
  }
  return children;
}

export type TrackedDatabase = {
  /** The binding to give the repository: same as the real one, with writes noted. */
  d1: D1Like;
  /** Puts the sample kitchens back, touching only what changed since the last call. */
  reset(): Promise<void>;
  /** A full wipe and re-seed (the repository's own dev reset has run, or is about to). */
  markFresh(): void;
};

export function trackWrites(real: D1Like, migrations: ReadonlyArray<string>): TrackedDatabase {
  const dirty = new Set<string>();
  let everything = true; // a database that was never reset is not known
  const note = (sql: string) => {
    const table = WRITE.exec(sql)?.[1];
    if (table) dirty.add(table);
    else if (!READ.test(sql)) everything = true;
  };
  const d1: D1Like = {
    prepare(sql) {
      note(sql);
      return new Tracked(real.prepare(sql), sql);
    },
    batch(statements) {
      return real.batch(statements.map((s) => (s instanceof Tracked ? s.inner : s)));
    },
  };
  const children = childrenOf(migrations);
  const db = new Db(d1);

  const closure = (): Set<string> => {
    const all = new Set(dirty);
    for (const table of all) for (const child of children.get(table) ?? []) all.add(child);
    return all;
  };

  return {
    d1,
    markFresh() {
      dirty.clear();
      everything = false;
    },
    async reset() {
      if (!everything && dirty.size === 0) return;
      if (everything) {
        await wipeAndSeed(db);
      } else {
        const tables = closure();
        if (
          [...tables].some(
            (table) => !(TABLES_CHILDREN_FIRST as ReadonlyArray<string>).includes(table),
          )
        ) {
          await wipeAndSeed(db);
          dirty.clear();
          everything = false;
          return;
        }
        const seeds = fixtureStatements(db).map((statement) => ({
          statement,
          table: WRITE.exec((statement as Tracked).sql)?.[1],
        }));
        if (seeds.some((seed) => seed.table === undefined)) {
          await wipeAndSeed(db);
        } else {
          await db.batch([
            ...TABLES_CHILDREN_FIRST.filter((table) => tables.has(table)).map((table) =>
              db.stmt(`DELETE FROM ${table}`),
            ),
            ...seeds
              .filter((seed) => tables.has(seed.table as string))
              .map((seed) => seed.statement),
          ]);
        }
      }
      dirty.clear();
      everything = false;
    },
  };
}
