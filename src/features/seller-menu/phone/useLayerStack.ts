import { useCallback, useEffect, useRef, useState } from 'react';

// Plan 124 (Q8 A): Android Back closes the open layer or sheet first, one step at a time. Every layer
// the phone Orders screen opens is one browser history entry (same URL, marked `phoneDepth`), so Back
// pops it and a button closes it with `history.back()`: both paths go through the one popstate
// listener, and no stale entry is left behind. Opening is always on a tap, so Chrome keeps the entry.

export type Layer = 'menu' | 'share' | 'publish' | 'live' | 'notice';

type Marked = { phoneDepth?: number } | null;
const depthNow = (): number => (window.history.state as Marked)?.phoneDepth ?? 0;
const marked = (depth: number) => ({
  ...(window.history.state as object | null),
  phoneDepth: depth,
});

export function useLayerStack() {
  const [stack, setStack] = useState<ReadonlyArray<Layer>>([]);
  // The same stack, readable right away inside an event handler.
  const now = useRef<ReadonlyArray<Layer>>([]);
  const apply = useCallback((next: ReadonlyArray<Layer>) => {
    now.current = next;
    setStack(next);
  }, []);

  useEffect(() => {
    // A reload keeps the marked history entry but not the layers: step back out of them.
    const stale = depthNow();
    if (stale > 0) window.history.go(-stale);
    const onPop = () => {
      const depth = depthNow();
      if (now.current.length > depth) apply(now.current.slice(0, depth));
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Leaving the screen with layers open: do not leave their entries behind.
      if (now.current.length > 0) window.history.go(-now.current.length);
    };
  }, [apply]);

  /** Opens a layer on top (a new history entry). */
  const push = useCallback(
    (layer: Layer) => {
      const next = [...now.current, layer];
      window.history.pushState(marked(next.length), '');
      apply(next);
    },
    [apply],
  );
  /** Swaps the top layer for another without a new entry (the publish sheet becomes "Menu is live"). */
  const replaceTop = useCallback(
    (layer: Layer) => {
      if (now.current.length === 0) return push(layer);
      window.history.replaceState(marked(now.current.length), '');
      apply([...now.current.slice(0, -1), layer]);
    },
    [apply, push],
  );
  /** Closes the top layer; the popstate listener updates the stack. */
  const back = useCallback(() => {
    if (now.current.length > 0) window.history.back();
  }, []);

  return { stack, push, replaceTop, back };
}
