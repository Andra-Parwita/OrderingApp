import { useCallback, useState } from 'react';

// Plan 078: the admin menu column can be dragged wider; lengths are in rem.
export const COLUMN_MIN = 12.5;
export const COLUMN_MAX = 30;
export const COLUMN_DEFAULT = 13.75;
export const COLUMN_STEP = 1;
export const COLUMN_KEY = 'admin.menuWidth';

const clamp = (rem: number): number =>
  Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, Math.round(rem * 4) / 4));

function read(): number {
  try {
    const stored = Number(window.localStorage.getItem(COLUMN_KEY));
    return Number.isFinite(stored) && stored >= COLUMN_MIN && stored <= COLUMN_MAX
      ? stored
      : COLUMN_DEFAULT;
  } catch {
    return COLUMN_DEFAULT;
  }
}

function write(rem: number | null): void {
  try {
    if (rem === null) window.localStorage.removeItem(COLUMN_KEY);
    else window.localStorage.setItem(COLUMN_KEY, String(rem));
  } catch {
    /* the width is a convenience only */
  }
}

/** The menu width in rem: `set` changes it (saved only when `save` is true), `reset` goes back. */
export function useColumnWidth() {
  const [width, setWidth] = useState<number>(read);
  const set = useCallback((rem: number, save: boolean) => {
    const next = clamp(rem);
    setWidth(next);
    if (save) write(next);
  }, []);
  const reset = useCallback(() => {
    setWidth(COLUMN_DEFAULT);
    write(null);
  }, []);
  return { width, set, reset } as const;
}
