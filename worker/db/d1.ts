// A thin, storage-shaped view of Cloudflare D1 (stage 8.1b). The structural types below are what
// the repository needs from `D1Database`, so this code compiles in the Worker, in tests and in
// scripts without depending on the global workers types.

export type D1Statement = {
  bind(...values: Array<unknown>): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: Array<T> }>;
  run(): Promise<unknown>;
};

export type D1Like = {
  prepare(query: string): D1Statement;
  batch(statements: Array<D1Statement>): Promise<Array<{ results?: Array<unknown> }>>;
};

type Rows = Array<unknown>;
export type ReadResults = [Rows, Rows, Rows, Rows, Rows, Rows, Rows, Rows];

type Param = string | number | boolean | null | undefined;

/** D1 rejects `undefined` and booleans; this makes both safe (booleans become 0 or 1). */
function clean(values: ReadonlyArray<Param>): Array<string | number | null> {
  return values.map((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

/** Prepared statements only: every value is bound, never spliced into the SQL. */
export class Db {
  constructor(readonly d1: D1Like) {}

  stmt(sql: string, ...params: Array<Param>): D1Statement {
    return this.d1.prepare(sql).bind(...clean(params));
  }

  async all<T>(sql: string, ...params: Array<Param>): Promise<Array<T>> {
    return (await this.stmt(sql, ...params).all<T>()).results;
  }

  async first<T>(sql: string, ...params: Array<Param>): Promise<T | null> {
    return this.stmt(sql, ...params).first<T>();
  }

  /** All statements in one atomic transaction (a D1 batch); returns each result's rows. */
  async batch(statements: Array<D1Statement>): Promise<Array<Array<unknown>>> {
    if (statements.length === 0) return [];
    const results = await this.d1.batch(statements);
    return results.map((result) => result.results ?? []);
  }

  /**
   * Several reads in one round trip. Typed as a tuple so a caller can destructure as many results
   * as it sent statements (never more than 8).
   */
  async reads(statements: Array<D1Statement>): Promise<ReadResults> {
    return (await this.batch(statements)) as ReadResults;
  }
}

/** `?, ?, ?` for an IN list. */
export function marks(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}
