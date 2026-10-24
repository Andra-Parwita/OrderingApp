import { useEffect, useState } from 'react';
import { fetchMenu } from '../../api/client';
import { sellerKitchenOfSearch } from '../../components/install/manifestLinks';

/** The name of the kitchen a seller link names (`?k=<slug>`, plan 101); null for none, or until it arrives. */
export function useLaunchKitchenName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const slug = sellerKitchenOfSearch(window.location.search);
    if (slug === undefined) return undefined;
    let live = true;
    void fetchMenu(slug).then((result) => {
      if (live && result.ok) setName(result.data.kitchen.name);
    });
    return () => {
      live = false;
    };
  }, []);
  return name;
}
