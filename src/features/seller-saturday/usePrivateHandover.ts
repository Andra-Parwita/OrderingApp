import { useCallback, useEffect, useState } from 'react';
import type { SellerOrder } from '../../../shared/domain';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchPrivate } from '../../api/private';

/**
 * Plan 081: the kitchen's private orders of today (not cancelled), team-only with their addresses.
 * Loaded on mount and again whenever `refresh` changes: the screen passes its menu orders, which
 * reload on the same live order events. Never put into the menu's list. An empty list while loading
 * or when the call fails.
 */
export function usePrivateHandover(refresh: unknown): {
  orders: ReadonlyArray<SellerOrder>;
  reload: () => void;
} {
  const [orders, setOrders] = useState<ReadonlyArray<SellerOrder>>([]);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    void fetchPrivate({ day: 'today' }, currentSellerSlug()).then((result) => {
      if (live && result.ok) setOrders(result.data.orders.filter((o) => o.status !== 'cancelled'));
    });
    return () => {
      live = false;
    };
  }, [refresh, attempt]);
  return { orders, reload };
}
