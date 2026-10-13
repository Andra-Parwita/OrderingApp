// Plan 073: a tiny in-memory cache for small reads that many screens repeat (the kitchen's
// settings, its preferences, the "is the menu published" flag). One entry per key, shared by the
// whole page session, gone on reload. Only answers that worked are kept; a save clears its entry.

type Entry = { at: number; value: unknown };

export const SHORT_TTL_MS = 60_000;
/** Key prefixes (the seller's slug follows). */
export const SETTINGS_PREFIX = 'settings:';
export const PREFERENCES_PREFIX = 'preferences:';
export const MENU_PREFIX = 'menu:';

const entries = new Map<string, Entry>();
const running = new Map<string, Promise<unknown>>();

/** The answer kept for `key` if it is younger than `ttl`, else a fresh read (`keep` says if it worked). */
export function cachedRead<T>(
  key: string,
  read: () => Promise<T>,
  keep: (value: T) => boolean,
  ttl = SHORT_TTL_MS,
): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value as T);
  const sameRead = running.get(key);
  if (sameRead) return sameRead as Promise<T>;
  const promise = read()
    .then((value) => {
      if (keep(value) && running.get(key) === promise) entries.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      if (running.get(key) === promise) running.delete(key);
    });
  running.set(key, promise);
  return promise;
}

/** Put a value in the cache directly (an answer that already carries it). */
export function setCached(key: string, value: unknown): void {
  entries.set(key, { at: Date.now(), value });
}

/** A save happened: forget these keys (and a read that is still running, so it cannot refill them). */
export function invalidateCached(...prefixes: Array<string>): void {
  for (const map of [entries, running] as Array<Map<string, unknown>>) {
    for (const key of [...map.keys()]) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) map.delete(key);
    }
  }
}

export function clearShortCache(): void {
  entries.clear();
  running.clear();
}
