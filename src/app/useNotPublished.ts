import { useEffect, useState } from 'react';
import { fetchCurrentMenuCached } from '../api/cachedReads';

/**
 * True while the kitchen's menu is not published: the Menu item shows a badge. Only the
 * seller asks (chefs have no Menu). Plan 073: the answer is kept for 2 minutes, and the menu
 * screens put the new menu in it when they publish or unpublish, so changing page does not ask again.
 */
export function useNotPublished(enabled: boolean, pathname: string): boolean {
  const [draft, setDraft] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    void fetchCurrentMenuCached().then((result) => {
      if (live) setDraft(result.ok && result.data.menu.menu.state === 'not_published');
    });
    return () => {
      live = false;
    };
  }, [enabled, pathname]);
  return enabled && draft;
}
