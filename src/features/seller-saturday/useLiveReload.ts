// Plan 074: a seller screen that keeps itself fresh from the kitchen's live connection (no timer of
// its own). It loads once, reloads when a live event arrives (a burst is one reload that names the
// event types, so the screen fetches only the parts that changed), and when the connection comes
// back. While the connection is down and the page is visible it checks every "seller backup
// minutes" (the admin's setting); a hidden page asks for nothing and reloads when it comes back.
import { useEffect, useRef } from 'react';
import type { LiveEventType } from '../../../shared/liveContract';
import { sellerBackupMs } from '../../api/backupMinutes';
import { sellerDeviceId } from '../../api/deviceId';
import { subscribeLive } from '../../api/live';

/** What to load: the event types since the last load, or null = everything. */
export type Wanted = ReadonlySet<LiveEventType> | null;

/** Events in the same burst (this long) make one reload. */
export const BURST_MS = 50;

export function useLiveReload(
  load: (wanted: Wanted) => Promise<void>,
  subscribe: typeof subscribeLive = subscribeLive,
): void {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    let live = false;
    let wentDown = false;
    let everything = false;
    const types = new Set<LiveEventType>();
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let burst: ReturnType<typeof setTimeout> | undefined;
    const hidden = () => document.visibilityState === 'hidden';

    const run = () => {
      clearTimeout(burst);
      if (!pending || hidden()) return; // a hidden page waits until it is shown
      const wanted: Wanted = everything ? null : new Set(types);
      pending = false;
      everything = false;
      types.clear();
      void loadRef.current(wanted);
    };
    const arm = () => {
      clearTimeout(timer);
      if (live || hidden()) return;
      timer = setTimeout(() => {
        pending = true;
        everything = true;
        run();
        arm();
      }, sellerBackupMs());
    };
    const want = (type: LiveEventType | null) => {
      pending = true;
      if (type === null) everything = true;
      else types.add(type);
      clearTimeout(burst);
      burst = setTimeout(run, BURST_MS);
    };

    const first = setTimeout(() => {
      pending = true;
      everything = true;
      run();
    }, 0);
    const stop = subscribe({
      onEvent: (event) => {
        // This device's own change (the Worker names the writer's device id): already applied here.
        // A change with no `from`, or another device's, is someone else's: reload.
        if (event.from !== undefined && event.from === sellerDeviceId()) return;
        want(event.type);
      },
      onStatus: (status) => {
        const wasLive = live;
        live = status === 'live';
        if (status === 'reconnecting') wentDown = true;
        if (live) {
          clearTimeout(timer);
          // Events may have been missed while it was down.
          if (!wasLive && wentDown) want(null);
          wentDown = false;
        } else arm();
      },
    });
    const onVisibility = () => {
      if (hidden()) {
        clearTimeout(timer);
        return;
      }
      want(null);
      arm();
    };
    document.addEventListener('visibilitychange', onVisibility);
    arm();
    return () => {
      clearTimeout(first);
      clearTimeout(timer);
      clearTimeout(burst);
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
    // `subscribe` is a test seam and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
