// Plan 059: notice a newer deploy. The build writes /version.json ({ "version": ... }, see
// vite.config.ts); the app compares it with the version it is running. Never in dev.

import { appVersion } from '../../../shared/buildInfo';

export const CHECK_GAP_MS = 5 * 60 * 1000;
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

/**
 * Checks on start and whenever the app comes back to the front, at most once every 5 minutes.
 * `onResult(true)` means a newer version is out; it is called after every check. Returns a stop function.
 */
export function watchForUpdate(
  onResult: (newer: boolean) => void,
  options: WatchOptions = {},
): () => void {
  const enabled = options.enabled ?? !import.meta.env.DEV;
  if (!enabled) return () => undefined;
  const current = options.current ?? appVersion();
  const now = options.now ?? Date.now;
  let last = -Infinity;
  let stopped = false;
  const check = (): void => {
    if (now() - last < CHECK_GAP_MS) return;
    last = now();
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
    reload();
  };
  window.addEventListener('vite:preloadError', handler);
  return () => window.removeEventListener('vite:preloadError', handler);
}

/** CSS variable on <html> holding the update bar's height while it shows; the offline banner sits below it. */
export const UPDATE_BAR_HEIGHT_VAR = '--update-bar-height';
