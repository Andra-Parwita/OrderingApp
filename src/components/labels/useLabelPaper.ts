import { useCallback, useState } from 'react';
import type { LabelPaper } from './labelModel';

const KEY = 'labels.paper';

function read(): LabelPaper {
  try {
    return window.localStorage.getItem(KEY) === 'roll' ? 'roll' : 'a4';
  } catch {
    return 'a4';
  }
}

/** The paper this device printed on last (A4 sheet or label roll); it is a per-device convenience. */
export function useLabelPaper(): readonly [LabelPaper, (paper: LabelPaper) => void] {
  const [paper, setPaper] = useState<LabelPaper>(read);
  const choose = useCallback((next: LabelPaper) => {
    setPaper(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // The choice still applies until the page closes.
    }
  }, []);
  return [paper, choose] as const;
}
