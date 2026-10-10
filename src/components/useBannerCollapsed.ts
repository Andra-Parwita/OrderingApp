import { useSyncExternalStore } from 'react';

// Plan 014: whether the Orders home banner is slid up to a thin strip; remembered on this device.
// The layout (banner) and the Orders screens (toggle) share it, so it is a tiny store over localStorage.
const STORAGE_KEY = 'sellerBannerCollapsed';
const listeners = new Set<() => void>();
let fallback = false; // used while storage is unavailable

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return fallback;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleBannerCollapsed(): void {
  const next = !read();
  fallback = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
  listeners.forEach((listener) => listener());
}

export function useBannerCollapsed(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
