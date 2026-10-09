import { useEffect, useState } from 'react';
import { fetchCurrentMenu } from '../api/client';
import { currentSellerSlug } from '../api/device/sellerContext';

/**
 * True while the kitchen's menu is not published: the Menu item shows a badge. Only the
 * seller asks (chefs have no Menu). It asks again when the page changes, so publishing is seen.
 */
export function useNotPublished(enabled: boolean, pathname: string): boolean {
  const [draft, setDraft] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    void fetchCurrentMenu(undefined, currentSellerSlug()).then((result) => {
      if (live) setDraft(result.ok && result.data.menu.menu.state === 'not_published');
    });
    return () => {
      live = false;
    };
  }, [enabled, pathname]);
  return enabled && draft;
}
