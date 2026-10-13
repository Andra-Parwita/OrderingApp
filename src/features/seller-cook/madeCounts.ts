import { useCallback, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addMade } from '../../api/made';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { isKeptCode, useAutoSave, type SaveResult } from '../../components/autoSave/autoSave';
import { draftKey } from '../../components/draft';
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

/** One dish's tapped count: where it started (the server's number) and where the taps left it. */
type MadePending = Record<string, { base: number; target: number }>;

/**
 * Made count per dish, from the server. A tap moves the number on screen at once (within 0..total);
 * one save follows ~1 s after the last tap (plan 073, the plan 072 auto-save), with the change since
 * the start (not each ±1): one request per dish that changed. The server adds, so other devices'
 * taps are kept and its answer is the truth. A refusal puts the screen back to the server's counts.
 */
export function useMadeCounts() {
  const stored = useSelector((state: CookRootState) => state.sellerCook.made);
  const dispatch = useDispatch();
  const slug = currentSellerSlug();
  // What the server already got of the pending change (a retry or a later tap sends only the rest).
  const sent = useRef<Record<string, number>>({});

  const send = useCallback(
    async (pending: MadePending): Promise<SaveResult> => {
      let answer: Record<string, number> | null = null;
      const finish = (result: SaveResult): SaveResult => {
        if (answer) dispatch(madeReplaced(answer));
        return result;
      };
      for (const [itemId, { base, target }] of Object.entries(pending)) {
        const delta = target - base - (sent.current[itemId] ?? 0);
        if (delta === 0) continue;
        const result = await addMade({ itemId, delta }, undefined, slug);
        if (!result.ok) {
          return finish({ ok: false, refused: !isKeptCode(result.error), code: result.error });
        }
        sent.current[itemId] = (sent.current[itemId] ?? 0) + delta;
        answer = result.data.made;
      }
      return finish({ ok: true });
    },
    [dispatch, slug],
  );
  const saver = useAutoSave<MadePending>(draftKey(slug, 'cook-made'), send);

  const made = useMemo(() => {
    const pending = saver.state.pending;
    if (!pending) return stored;
    const shown = { ...stored };
    for (const [itemId, { target }] of Object.entries(pending)) shown[itemId] = target;
    return shown;
  }, [stored, saver.state.pending]);

  const { update } = saver;
  const change = useCallback(
    (itemId: string, delta: number, total: number) => {
      const before = made[itemId] ?? 0;
      const target = Math.max(0, Math.min(total, before + delta));
      if (target === before) return;
      update((previous) => {
        if (previous === null) sent.current = {};
        return {
          ...previous,
          [itemId]: { base: previous?.[itemId]?.base ?? stored[itemId] ?? 0, target },
        };
      });
    },
    [made, stored, update],
  );
  return { made, change, saver };
}
