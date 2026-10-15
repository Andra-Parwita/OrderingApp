import { useCallback, useEffect, useState } from 'react';

export const SECTIONS = ['sellers', 'announce', 'settings', 'problems', 'devices'] as const;
export type Section = (typeof SECTIONS)[number];

const PARAM = 's';

function fromAddress(): Section {
  const asked = new URLSearchParams(window.location.search).get(PARAM);
  return SECTIONS.find((id) => id === asked) ?? 'sellers';
}

/**
 * Plan 078: the chosen admin section lives in the address (`?s=devices`) so reload and Back keep it.
 * Plain history calls (no router), so the screen also works where no router is mounted.
 */
export function useSection(): readonly [Section, (next: Section) => void] {
  const [section, setSection] = useState<Section>(fromAddress);

  useEffect(() => {
    const onPop = () => setSection(fromAddress());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const choose = useCallback((next: Section) => {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === 'sellers') url.searchParams.delete(PARAM);
    else url.searchParams.set(PARAM, next);
    const address = url.pathname + url.search + url.hash;
    if (address !== window.location.pathname + window.location.search + window.location.hash) {
      history.pushState(history.state, '', address);
    }
  }, []);

  return [section, choose] as const;
}
