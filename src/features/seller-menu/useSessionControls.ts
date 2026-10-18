import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useStore } from 'react-redux';
import {
  diffSession,
  type DraftSession,
  type SessionDiff,
  type SessionState,
} from './draftSession';
import type { MenuData, MenuRootState } from './menuSlice';
import { saveSession } from './saveSession';

export type SavePhase = 'idle' | 'saving' | 'saved' | 'failed';

/** How long "Saved ✓" stays before the sheet closes or the small confirmation goes. */
export const SAVED_MS = 1500;

/** What the footer and the pill need from a session: the count, and Save / Discard. */
export function useSessionControls(
  session: DraftSession,
  saved: MenuData,
): {
  diff: SessionDiff;
  phase: SavePhase;
  /** Saves everything; resolves true when it all reached the server. */
  save: () => Promise<boolean>;
  discard: () => void;
} {
  const store = useStore<MenuRootState>();
  const state = useSyncExternalStore(session.subscribe, session.getState);
  const diff = useMemo(() => diffSession(saved, state), [saved, state]);
  // The last save's answer holds while the session stays as it was left; a new change clears it.
  const [last, setLast] = useState<{ phase: SavePhase; at: SessionState | null }>({
    phase: 'idle',
    at: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setLast({ phase: 'saving', at: null });
    const outcome = await saveSession(session, store);
    setLast({ phase: outcome.ok ? 'saved' : 'failed', at: session.getState() });
    if (outcome.ok)
      timer.current = setTimeout(() => setLast({ phase: 'idle', at: null }), SAVED_MS);
    return outcome.ok;
  }, [session, store]);
  const discard = useCallback(() => {
    session.reset();
    setLast({ phase: 'idle', at: null });
  }, [session]);
  const phase = last.phase === 'saving' || last.at === state ? last.phase : 'idle';
  return { diff, phase, save, discard };
}
