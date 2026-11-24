import { useCallback, useSyncExternalStore } from 'react';

// Plan 134: the seller phone is below 600 px (the app's layout.ts DESKTOP_MIN_PX); a feature may not
// import the app, so the same breakpoint is written here once (37.4375rem = 599 px, as the editors use).
export const PHONE_QUERY = '(max-width: 37.4375rem)';

const matches = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;

/** True on the seller phone. False where matchMedia is missing (some unit tests). */
export function usePhone(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => undefined;
    const media = window.matchMedia(PHONE_QUERY);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return useSyncExternalStore(subscribe, matches, () => false);
}
