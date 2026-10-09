// Counts the D1 queries a request issues (stage 8.4b). The free Workers plan allows 50 D1 queries
// per invocation. This wraps the D1 binding and counts two ways: `count()` is round trips (each
// first/all/run is one, and a whole batch is one: the way the limit counts a batch), `statements()`
// also counts every statement inside a batch (the strict reading). Tests keep both low.
import type { D1Like, D1Statement } from '../worker/db/d1';

class Counted implements D1Statement {
  constructor(
    readonly inner: D1Statement,
    private readonly hit: () => void,
  ) {}
  bind(...values: Array<unknown>): D1Statement {
    return new Counted(this.inner.bind(...values), this.hit);
  }
  first<T = unknown>(): Promise<T | null> {
    this.hit();
    return this.inner.first<T>();
  }
  all<T = unknown>(): Promise<{ results: Array<T> }> {
    this.hit();
    return this.inner.all<T>();
  }
  run(): Promise<unknown> {
    this.hit();
    return this.inner.run();
  }
}

export type QueryCounter = {
  d1: D1Like;
  /** Round trips since the last `reset`. */
  count(): number;
  /** Statements run since the last `reset`, counting each one inside a batch. */
  statements(): number;
  reset(): void;
};

export function countQueries(real: D1Like): QueryCounter {
  let trips = 0;
  let statements = 0;
  const hit = () => {
    trips++;
    statements++;
  };
  return {
    d1: {
      prepare: (sql) => new Counted(real.prepare(sql), hit),
      batch: (list) => {
        trips++;
        statements += list.length;
        return real.batch(list.map((s) => (s instanceof Counted ? s.inner : s)));
      },
    },
    count: () => trips,
    statements: () => statements,
    reset: () => {
      trips = 0;
      statements = 0;
    },
  };
}
