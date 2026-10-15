// Plan 080: each top bar reports its height here while it shows. The sum goes to `--top-bars` on
// <html> (0 with no bar); the update bar and the notice also keep their own variable, which the
// bars below them use as their offset.
import { useEffect, type RefObject } from 'react';
import { TOP_BARS_VAR } from './screen';

const heights = new Map<string, number>();

function publish(): void {
  let sum = 0;
  heights.forEach((h) => (sum += h));
  document.documentElement.style.setProperty(TOP_BARS_VAR, `${sum}px`);
}

/** Sets this bar's height (0 removes it) and updates `--top-bars`. */
export function setTopBarHeight(id: string, height: number, ownVar?: string): void {
  const root = document.documentElement;
  if (height > 0) heights.set(id, height);
  else heights.delete(id);
  if (ownVar) {
    if (height > 0) root.style.setProperty(ownVar, `${height}px`);
    else root.style.removeProperty(ownVar);
  }
  publish();
}

/** Keeps `--top-bars` right while `active`: measured on show, and again on every resize or wrap. */
export function useTopBar(
  id: string,
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  ownVar?: string,
): void {
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const measure = (): void => setTopBarHeight(id, node.offsetHeight, ownVar);
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(node);
    window.addEventListener('resize', measure);
    return () => {
      watch?.disconnect();
      window.removeEventListener('resize', measure);
      setTopBarHeight(id, 0, ownVar);
    };
  }, [id, ref, active, ownVar]);
}
