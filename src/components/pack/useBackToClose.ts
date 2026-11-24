import { useEffect, useRef } from 'react';

// Android Back closes the open sheet first (like the other layers): the sheet is one history entry
// (same URL, marked `packSheet`). `onBack` says whether the sheet is done (true) or stays open (false,
// e.g. it asks "Close without saving?"; the entry is put back). A button close just unmounts: the entry
// is then removed with history.back() after a tick, unless another sheet (the next order) took over.

type Marked = { packSheet?: boolean } | null;
let active = 0;

export function useBackToClose(onBack: () => boolean): void {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    active += 1;
    const marked = (): boolean => (window.history.state as Marked)?.packSheet === true;
    const mark = (): void =>
      window.history.pushState({ ...(window.history.state as object | null), packSheet: true }, '');
    if (!marked()) mark();
    const onPop = () => {
      if (!latest.current()) mark();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      active -= 1;
      setTimeout(() => {
        if (active === 0 && marked()) window.history.back();
      }, 0);
    };
  }, []);
}
