import { useEffect, useState } from 'react';
import type { Languages } from '../../shared/domain';
import { fetchSettingsCached } from './cachedReads';

/** Plan 056: the languages the signed-in kitchen offers customers ("both" until known or if unreadable). */
export function useSellerLanguages(): Languages {
  const [languages, setLanguages] = useState<Languages>('both');
  useEffect(() => {
    let live = true;
    void fetchSettingsCached().then((result) => {
      if (live && result.ok) setLanguages(result.data.settings.languages ?? 'both');
    });
    return () => {
      live = false;
    };
  }, []);
  return languages;
}
