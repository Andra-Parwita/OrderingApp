import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addMade } from '../../api/made';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { madeReplaced, type CookRootState } from './cookSlice';

// "Count mode" stays on this device. How many of each dish are made is on the server (plan 035),
// so every phone and tablet of the kitchen shows the same numbers.

const MODE_KEY = 'cook-count-mode';

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

export function useCountMode(): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState(() => read(MODE_KEY) !== 'off');
  const set = useCallback((next: boolean) => {
    setOn(next);
    write(MODE_KEY, next ? 'on' : 'off');
  }, []);
  return [on, set];
}

/** Made count per dish, from the server; `change` moves it by ±1 within 0..total. */
export function useMadeCounts() {
  const made = useSelector((state: CookRootState) => state.sellerCook.made);
  const dispatch = useDispatch();
  const change = useCallback(
    (itemId: string, delta: number, total: number) => {
      const before = made[itemId] ?? 0;
      const step = Math.max(0, Math.min(total, before + delta)) - before;
      if (step === 0) return;
      dispatch(madeReplaced({ ...made, [itemId]: before + step }));
      void addMade({ itemId, delta: step }, undefined, currentSellerSlug()).then((result) => {
        // The server adds, so its answer is the truth (it includes other devices' taps).
        if (result.ok) dispatch(madeReplaced(result.data.made));
        else dispatch(madeReplaced(made));
      });
    },
    [made, dispatch],
  );
  return { made, change };
}
