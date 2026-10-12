// What the app knows about the network right now (plan 062). `http.ts` records the final result of
// every API call here; the polls, the live connection and the offline banner read it. No imports,
// so any module can use it without a cycle.

/** How a call ended: `ok`, `transient` (no answer, 5xx), `refused` (4xx the server meant), or `unauthorized` (401). */
export type Outcome = 'ok' | 'transient' | 'refused' | 'unauthorized';

export type NetSnapshot = {
  /** The last call got no answer or a server error. Cleared by the next call that works. */
  failing: boolean;
  /** A poll gave up after repeated refusals; "Try again" restarts it. */
  stopped: boolean;
};

/** A poll's gap doubles after each failure, up to 5 minutes. */
export const POLL_GAP_MAX_MS = 300_000;
/** This many refusals in a row stop a poll until the person taps Try again. */
export const MAX_REFUSALS = 5;

const LOG_MAX = 100;
let seq = 0;
let log: Array<{ seq: number; outcome: Outcome }> = [];
let snapshot: NetSnapshot = { failing: false, stopped: false };
const watchers = new Set<() => void>();
const retryHandlers = new Set<() => void>();
const unauthorizedHandlers = new Set<() => void>();

function set(next: Partial<NetSnapshot>) {
  const merged = { ...snapshot, ...next };
  if (merged.failing === snapshot.failing && merged.stopped === snapshot.stopped) return;
  snapshot = merged;
  for (const watcher of [...watchers]) watcher();
}

/** The outcome of an HTTP status. 404 (an expired order) and 409 (a conflict) are answers, not refusals. */
export function outcomeOf(status: number): Outcome {
  if (status === 401) return 'unauthorized';
  if (status === 0 || status >= 500) return 'transient';
  if (status >= 400 && status !== 404 && status !== 409) return 'refused';
  return 'ok';
}

/** Called by `http.ts` with the final result of a call (after any retries). */
export function recordOutcome(method: string, status: number): void {
  const outcome = outcomeOf(status);
  if (method === 'GET') {
    seq += 1;
    log.push({ seq, outcome });
    if (log.length > LOG_MAX) log = log.slice(-LOG_MAX);
  }
  set({ failing: outcome === 'transient' });
  if (outcome === 'unauthorized') for (const handler of [...unauthorizedHandlers]) handler();
}

/** A marker; `outcomeSince(marker)` is the worst result of the GET calls made after it. */
export function markOutcomes(): number {
  return seq;
}

export function outcomeSince(marker: number): Outcome {
  let worst: Outcome = 'ok';
  for (const entry of log) {
    if (entry.seq <= marker) continue;
    if (entry.outcome === 'unauthorized') return 'unauthorized';
    if (entry.outcome === 'refused') worst = 'refused';
    else if (entry.outcome === 'transient' && worst === 'ok') worst = 'transient';
  }
  return worst;
}

export function getNetSnapshot(): NetSnapshot {
  return snapshot;
}

export function watchNet(onChange: () => void): () => void {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}

/** A poll gave up (or is working again). */
export function setPollsStopped(stopped: boolean): void {
  set({ stopped });
}

/** The person tapped Try again: stopped polls restart. */
export function requestRetry(): void {
  set({ stopped: false });
  for (const handler of [...retryHandlers]) handler();
}

/** Polls register here to restart on Try again; returns the way to stop. */
export function onRetry(handler: () => void): () => void {
  retryHandlers.add(handler);
  return () => {
    retryHandlers.delete(handler);
  };
}

/** Called when any call gets a 401 (the session is gone). */
export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandlers.add(handler);
  return () => {
    unauthorizedHandlers.delete(handler);
  };
}

/** Tests only. */
export function resetNetState(): void {
  seq = 0;
  log = [];
  snapshot = { failing: false, stopped: false };
  watchers.clear();
  retryHandlers.clear();
  unauthorizedHandlers.clear();
}
