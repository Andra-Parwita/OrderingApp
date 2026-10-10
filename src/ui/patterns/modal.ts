import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Focus handling for a modal box: focus moves into it on open (to the element marked
 * `data-autofocus`, else the box), Tab stays inside, Escape calls `onEscape`, and focus returns to
 * the opener when it closes.
 */
export function useModalFocus<T extends HTMLElement>(onEscape: () => void) {
  const box = useRef<T>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = box.current?.querySelector<HTMLElement>('[data-autofocus]');
    (first ?? box.current)?.focus();
    return () => {
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, []);
  const onKeyDown = useCallback(
    (event: KeyboardEvent<T>) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== 'Tab' || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === box.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onEscape],
  );
  return { box, onKeyDown };
}
