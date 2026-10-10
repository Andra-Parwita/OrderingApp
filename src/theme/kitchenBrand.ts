import { useSyncExternalStore } from 'react';
import type { Brand } from './designTokens';

// The kitchen's colour theme (D-064, per kitchen: `/preferences` `theme`). The seller app sets it
// once it is known; AppThemeProvider reads it. It is not remembered on the device: the server
// holds it, and the seller app sets it again on entry. Light / dark is separate (themePreference).

const listeners = new Set<() => void>();
let current: Brand = 'onde';

export function setKitchenBrand(next: Brand): void {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useKitchenBrand(): Brand {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'onde',
  );
}
