import { useCallback, useEffect, useRef, useState } from 'react';
import { clearDraft, readDraft, writeDraft } from './draftStore';

export const DRAFT_DEBOUNCE_MS = 400;

export type DraftControls = Readonly<{
  /** The form opened with what was typed earlier. */
  restored: boolean;
  /** The server's version changed since the draft began (never overwritten silently). */
  conflict: boolean;
  /** Back to the server values; forgets the draft. */
  discard: () => void;
  /** Forget the draft (after the server accepted a Save / Submit). The value is left alone. */
  clear: () => void;
  /** Conflict: keep what was typed, against the new server version. */
  keepMine: () => void;
  /** Conflict: take the server's version (same as discard). */
  useSaved: () => void;
}>;

export type DraftOptions = Readonly<{
  /** Fingerprint of the server values the form started from; a different one on reopen is a conflict. */
  baseline?: string;
}>;

/**
 * Form state that survives a reload or a closed slide-over. Saves 400 ms after the last change
 * and when the page is hidden; a draft equal to `initial` is not stored. Mount one per key
 * (give the component a `key` if the id can change). Never put a secret in it.
 */
export function useDraft<T>(
  key: string,
  initial: T,
  options: DraftOptions = {},
): [T, (next: T | ((previous: T) => T)) => void, DraftControls] {
  const baseline = options.baseline ?? '';
  const initialRef = useRef(initial);
  const baselineRef = useRef(baseline);
  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);
  const [found] = useState(() => readDraft<T>(key));
  const [value, setState] = useState<T>(found ? found.value : initial);
  const [restored, setRestored] = useState(found !== null);
  const [conflict, setConflict] = useState(found !== null && found.baseline !== baseline);
  const valueRef = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  const flush = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (!pending.current) return;
    pending.current = false;
    if (JSON.stringify(valueRef.current) === JSON.stringify(initialRef.current)) clearDraft(key);
    else writeDraft(key, valueRef.current, baselineRef.current);
  }, [key]);

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      setState(resolved);
      pending.current = true;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(flush, DRAFT_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush(); // closed within the debounce: still keep what was typed
    };
  }, [flush]);

  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = false;
    clearDraft(key);
    setRestored(false);
    setConflict(false);
  }, [key]);

  const discard = useCallback(() => {
    clear();
    valueRef.current = initialRef.current;
    setState(initialRef.current);
  }, [clear]);

  const keepMine = useCallback(() => {
    setConflict(false);
    pending.current = true; // rewrite the draft against the new server version
    flush();
  }, [flush]);

  return [value, setValue, { restored, conflict, discard, clear, keepMine, useSaved: discard }];
}
