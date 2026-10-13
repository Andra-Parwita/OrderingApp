// The slow backup check's timer (plan 062; since plan 074 only while the live connection is down). Every `baseMs` while things work; the gap doubles
// after each failed refresh (up to 5 minutes) and resets on a good one. It pauses while the tab is
// hidden (one refresh on return), and stops after 5 refusals in a row until the person taps Try
// again (the banner, see components/network). How a refresh ended is read from api/netState.
import {
  MAX_REFUSALS,
  POLL_GAP_MAX_MS,
  markOutcomes,
  onRetry,
  outcomeSince,
  setPollsStopped,
} from '../../api/netState';

export function startOrderPoll(refresh: () => void, baseMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let marker: number | null = null;
  let failures = 0;
  let refusals = 0;
  let stopped = false;
  let paused = false;

  const schedule = () => {
    clearTimeout(timer);
    // A base gap longer than the cap (a 30 minute backup check) never shrinks on a failure.
    timer = setTimeout(tick, Math.min(Math.max(POLL_GAP_MAX_MS, baseMs), baseMs * 2 ** failures));
  };

  // Learns how the last refresh ended; false when the poll must stop.
  const judge = (): boolean => {
    if (marker !== null) {
      const outcome = outcomeSince(marker);
      failures = outcome === 'ok' ? 0 : failures + 1;
      refusals = outcome === 'refused' || outcome === 'unauthorized' ? refusals + 1 : 0;
    }
    if (refusals >= MAX_REFUSALS) {
      stopped = true;
      setPollsStopped(true);
      return false;
    }
    return true;
  };

  function go() {
    if (!judge()) return;
    marker = markOutcomes();
    refresh();
    schedule();
  }

  function tick() {
    if (document.hidden) {
      paused = true;
      return;
    }
    go();
  }

  const onVisible = () => {
    if (!document.hidden && paused) {
      paused = false;
      go();
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  const stopRetry = onRetry(() => {
    if (!stopped) return;
    stopped = false;
    failures = 0;
    refusals = 0;
    marker = null;
    go();
  });

  schedule();
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    stopRetry();
    if (stopped) setPollsStopped(false);
  };
}
