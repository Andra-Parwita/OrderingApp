import { useCallback, useState } from 'react';

const STORAGE_KEY = 'sellerRailCollapsed';

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether the seller rail is collapsed to icons; remembered on this device (D-032). */
export function useRailCollapsed(): readonly [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(read);
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // storage unavailable: the choice lasts until the page closes
      }
      return next;
    });
  }, []);
  return [collapsed, toggle];
}
