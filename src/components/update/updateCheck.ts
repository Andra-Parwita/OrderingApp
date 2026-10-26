// Plan 059: notice a newer deploy. The build writes /version.json ({ "version": ... }, see
// vite.config.ts); the app compares it with the version it is running. Never in dev.

import { appVersion } from '../../../shared/buildInfo';

export const CHECK_GAP_MS = 10 * 60 * 1000;
const LAST_CHECK_KEY = 'updateLastCheck';
const RELOAD_FLAG = 'updateReloaded';

export type WatchOptions = Readonly<{
  /** The running version. */
  current?: string;
  /** Off in dev (there is no version.json); tests turn it on. */
  enabled?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}>;

/** The deployed version, or null when it cannot be read (offline, no file): then nothing is shown. */
export async function fetchLatestVersion(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetchImpl('/version.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === 'string' ? body.version : null;
  } catch {
    return null;
  }
}

// The time of the last check is kept on the phone, so reopening the app does not ask the server
// again within the gap. Storage can be blocked: then the time lives in memory for this session.
let lastInMemory = -Infinity;
function readLastCheck(): number {
  try {
    const saved = localStorage.getItem(LAST_CHECK_KEY);
    const value = saved === null ? NaN : Number(saved);
    return Number.isFinite(value) ? value : -Infinity;
  } catch {
    return lastInMemory;
  }
}
function writeLastCheck(time: number): void {
  lastInMemory = time;
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(time));
  } catch {
    // memory only
  }
}

/**
 * Checks when the app opens and whenever it comes back to the front, at most once every 10 minutes
 * (also across reloads: the last check time is saved). No timer (plan 125). `onResult(true)` means a
 * newer version is out; it is called after every check. Returns a stop function.
 */
export function watchForUpdate(
  onResult: (newer: boolean) => void,
  options: WatchOptions = {},
): () => void {
  const enabled = options.enabled ?? !import.meta.env.DEV;
  if (!enabled) return () => undefined;
  const current = options.current ?? appVersion();
  const now = options.now ?? Date.now;
  let stopped = false;
  const check = (): void => {
    if (now() - readLastCheck() < CHECK_GAP_MS) return;
    writeLastCheck(now());
    void fetchLatestVersion(options.fetchImpl).then((latest) => {
      if (!stopped && latest !== null) onResult(latest !== current);
    });
  };
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', onVisible);
  check();
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/** A check the user asked for (About): ignores the gap, records the time, and says what it found. */
export async function checkForUpdateNow(
  options: Pick<WatchOptions, 'current' | 'fetchImpl' | 'now'> = {},
): Promise<'newer' | 'same' | 'error'> {
  writeLastCheck((options.now ?? Date.now)());
  const latest = await fetchLatestVersion(options.fetchImpl);
  if (latest === null) return 'error';
  return latest !== (options.current ?? appVersion()) ? 'newer' : 'same';
}

/**
 * A lazy part of the app that a deploy replaced is gone: reload once to get the new files. The
 * sessionStorage flag stops a reload loop: a session that fails again keeps the error.
 */
export function reloadOnPreloadError(
  reload: () => void = () => window.location.reload(),
): () => void {
  const handler = (): void => {
    try {
      if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
      sessionStorage.setItem(RELOAD_FLAG, '1');
    } catch {
      return; // no storage: cannot guard against a loop, so do not reload
    }
    // Plan 115 stage 2: the service worker answers pages from a saved copy. Drop the copies first,
    // so the reload goes to the network instead of getting the same old page again.
    const dropSavedPages = async (): Promise<void> => {
      if (!('caches' in window)) return;
      const names = await window.caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('shell-')).map((n) => window.caches.delete(n)),
      );
    };
    dropSavedPages()
      .catch(() => undefined)
      .finally(reload);
  };
  window.addEventListener('vite:preloadError', handler);
  return () => window.removeEventListener('vite:preloadError', handler);
}

/** CSS variable on <html> holding the update bar's height while it shows; the offline banner sits below it. */
export const UPDATE_BAR_HEIGHT_VAR = '--update-bar-height';
