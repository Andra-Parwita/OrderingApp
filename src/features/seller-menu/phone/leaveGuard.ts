import { useEffect, useRef } from 'react';

// Plan 134: on the phone Android Back must not drop work. While a guard is armed, one extra history
// entry (a sentinel) sits above the screen; Back pops it, the screen stays, and `onBlocked` asks what
// to do ("Save N changes?", or go to Orders). The sentinel is then put back with `history.forward()`,
// not with a new pushState: a pushState made without a tap is "skippable" in Chrome, which lets the
// next Back run past the screen and out of the app. The wizard's Close pops the sentinel with the
// rest (see `releaseGuard`), so no stale entry is left behind. The router reads only its own keys
// from the history state, so the sentinel (a copy of the state with a flag) is invisible to it.

let armed = false;
const flagged = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'leaveGuard' in state;

/** Disarms the guard and says how many history entries it holds (0 or 1); the caller pops them. */
export function releaseGuard(): number {
  const held = armed ? 1 : 0;
  armed = false;
  return held;
}

/** Arms the guard while `active`; Back then calls `onBlocked` instead of leaving. */
export function useLeaveGuard(active: boolean, onBlocked: () => void): void {
  const latest = useRef(onBlocked);
  useEffect(() => {
    latest.current = onBlocked;
  });
  useEffect(() => {
    if (!active) return undefined;
    window.history.pushState({ ...(window.history.state as object | null), leaveGuard: true }, '');
    armed = true;
    const onPop = () => {
      if (!armed || flagged(window.history.state)) return;
      // Back popped the sentinel: step forward onto it again (queued before whatever `onBlocked`
      // does, so a close that pops the guard with `releaseGuard` still counts it).
      window.history.forward();
      latest.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (armed) {
        // The work is done (saved or discarded): take the sentinel away.
        armed = false;
        window.history.back();
      }
    };
  }, [active]);
}
