import { useSyncExternalStore } from 'react';

export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'theme';
const listeners = new Set<() => void>();

function isPreference(value: unknown): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/** The remembered choice; "auto" (match the device) when nothing is saved or storage is blocked. */
export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isPreference(saved)) return saved;
  } catch {
    // storage unavailable: follow the device
  }
  return 'auto';
}

let current: ThemePreference = readThemePreference();

export function setThemePreference(next: ThemePreference): void {
  current = next;
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

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'auto',
  );
}
