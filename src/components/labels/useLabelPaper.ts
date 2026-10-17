import { useCallback, useState } from 'react';
import type { LabelPaper } from './labelModel';

const KEY = 'labels.paper';
const ROLL_KEY = 'labels.hasRoll';

function readPaper(): LabelPaper {
  try {
    return window.localStorage.getItem(KEY) === 'roll' ? 'roll' : 'a4';
  } catch {
    return 'a4';
  }
}

function readHasRoll(): boolean {
  try {
    return window.localStorage.getItem(ROLL_KEY) === '1';
  } catch {
    return false;
  }
}

function save(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The choice still applies until the page closes.
  }
}

export type LabelPaperState = Readonly<{
  /** What prints: always A4 unless this device has said it has a label printer. */
  paper: LabelPaper;
  choose: (paper: LabelPaper) => void;
  hasRoll: boolean;
  setHasRoll: (on: boolean) => void;
}>;

/**
 * The paper this device prints on (A4 sheet or label roll) and whether it has a label printer at
 * all (plan 084). Both are per-device conveniences kept in localStorage; the roll is off by default.
 */
export function useLabelPaper(): LabelPaperState {
  const [stored, setStored] = useState<LabelPaper>(readPaper);
  const [hasRoll, setRoll] = useState<boolean>(readHasRoll);
  const choose = useCallback((next: LabelPaper) => {
    setStored(next);
    save(KEY, next);
  }, []);
  const setHasRoll = useCallback((on: boolean) => {
    setRoll(on);
    save(ROLL_KEY, on ? '1' : '0');
  }, []);
  return { paper: hasRoll ? stored : 'a4', choose, hasRoll, setHasRoll };
}
