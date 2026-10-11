import { useSyncExternalStore } from 'react';

export type TextSize = 'smaller' | 'normal' | 'larger';

export const TEXT_SIZES: ReadonlyArray<TextSize> = ['smaller', 'normal', 'larger'];

const STORAGE_KEY = 'textSize';
/** Percent of the browser's own font size, so browser zoom and the phone's text size still apply. */
const PERCENT: Record<TextSize, string> = { smaller: '87.5%', normal: '100%', larger: '112.5%' };
const listeners = new Set<() => void>();

function isTextSize(value: unknown): value is TextSize {
  return TEXT_SIZES.includes(value as TextSize);
}

/** The remembered choice; "normal" when nothing is saved or storage is blocked. */
export function readTextSize(): TextSize {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isTextSize(saved)) return saved;
  } catch {
    // storage unavailable: normal size
  }
  return 'normal';
}

function apply(size: TextSize): void {
  document.documentElement.style.fontSize = PERCENT[size];
}

let current: TextSize = readTextSize();
// Module load runs before React renders, so the size is set before the first paint.
apply(current);

export function setTextSize(next: TextSize): void {
  current = next;
  apply(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useTextSize(): TextSize {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'normal',
  );
}
