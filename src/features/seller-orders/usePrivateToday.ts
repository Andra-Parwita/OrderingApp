import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { Order } from '../../../shared/domain';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchPrivate } from '../../api/private';
import { selectOrders } from './sellerOrdersSelectors';

/**
 * Plan 081: the kitchen's private orders of today (not cancelled), kept out of the menu's lists and
 * stats. Loaded on mount and again whenever the menu orders reload (the same live events).
 * An empty list while loading or when the call fails: the section just stays hidden.
 */
export function usePrivateToday(): { orders: ReadonlyArray<Order>; reload: () => void } {
  const [orders, setOrders] = useState<ReadonlyArray<Order>>([]);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const menuOrders = useSelector(selectOrders);
  useEffect(() => {
    let live = true;
    void fetchPrivate({ day: 'today' }, currentSellerSlug()).then((result) => {
      if (live && result.ok) setOrders(result.data.orders);
    });
    return () => {
      live = false;
    };
  }, [menuOrders, attempt]);
  return { orders, reload };
}
