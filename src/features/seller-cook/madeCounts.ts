import { useCallback, useState } from 'react';

// "Count mode" and how many of each dish are made, kept on this device only (not on the server).

const MODE_KEY = 'cook-count-mode';
const madeKey = (cookingDate: string) => `cook-made:${cookingDate}`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private window or blocked storage: the counts last until the page closes.
  }
}

export function parseMade(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const out: Record<string, number> = {};
    for (const [id, count] of Object.entries(value)) {
      if (typeof count === 'number' && Number.isInteger(count) && count > 0) out[id] = count;
    }
    return out;
  } catch {
    return {};
  }
}

export function useCountMode(): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState(() => read(MODE_KEY) !== 'off');
  const set = useCallback((next: boolean) => {
    setOn(next);
    write(MODE_KEY, next ? 'on' : 'off');
  }, []);
  return [on, set];
}

/** Made count per dish for one cooking day; `change` moves it by ±1 within 0..total. */
export function useMadeCounts(cookingDate: string) {
  const [made, setMade] = useState(() => parseMade(read(madeKey(cookingDate))));
  const change = useCallback(
    (itemId: string, delta: number, total: number) => {
      setMade((now) => {
        const next = { ...now, [itemId]: Math.max(0, Math.min(total, (now[itemId] ?? 0) + delta)) };
        write(madeKey(cookingDate), JSON.stringify(next));
        return next;
      });
    },
    [cookingDate],
  );
  return { made, change };
}
