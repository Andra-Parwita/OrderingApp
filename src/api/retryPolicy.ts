// One retry rule for every API call (plan 062). Only safe calls are retried: a GET that got no
// answer, a server error (5xx) or "slow down" (429). A save (POST, PATCH, PUT, DELETE) is never
// repeated by itself, so nothing is ever ordered twice; the screen says "Didn't go through".

/** The waits before retry 1, 2 and 3 (about 1 s, 3 s, 9 s). */
export const RETRY_DELAYS_MS: ReadonlyArray<number> = [1000, 3000, 9000];

let delays: ReadonlyArray<number> = RETRY_DELAYS_MS;
/** How many retries a call gets and how long each waits. Tests set `[]` so a failing call fails at once. */
export function setRetryDelays(next: ReadonlyArray<number>): void {
  delays = next;
}
export function retryCount(): number {
  return delays.length;
}
export const RETRY_AFTER_MAX_MS = 30_000;
const JITTER = 0.25;

/** Only a GET, and only when there was no answer, a 5xx or a 429. */
export function isRetryable(method: string, status: number): boolean {
  if (method !== 'GET') return false;
  return status === 0 || status === 429 || status >= 500;
}

/** The wait before retry number `retry` (0-based): the base delay plus up to 25 % jitter; a 429's Retry-After wins, capped at 30 s. */
export function retryDelayMs(
  retry: number,
  retryAfterHeader: string | null = null,
  random: () => number = Math.random,
): number {
  const seconds = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(RETRY_AFTER_MAX_MS, seconds * 1000);
  const base = delays[retry] ?? delays[delays.length - 1] ?? 1000;
  return Math.round(base * (1 + JITTER * random()));
}

/** The server said no (401, 403 or another 4xx): asking again will not help. */
export function refused(status: number): boolean {
  return status >= 400 && status < 500;
}
