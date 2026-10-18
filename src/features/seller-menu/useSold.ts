import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { SellerOrder } from '../../../shared/domain';
import { soldRequested, type SoldOrdersState } from '../../api/soldOrders';

const NONE: ReadonlyArray<SellerOrder> = [];

/**
 * Order count and the quantity sold per menu dish, from the live orders (cancelled ones left out).
 * Plan 103: reads the orders slice (one read when the screen opens) instead of its own GET.
 */
export function useSold(enabled: boolean): { orders: number; sold: Map<string, number> } {
  const dispatch = useDispatch();
  const orders = useSelector((state: SoldOrdersState) => state.sellerOrders?.orders ?? NONE);
  useEffect(() => {
    if (enabled) dispatch(soldRequested());
  }, [enabled, dispatch]);
  return useMemo(() => {
    const sold = new Map<string, number>();
    let count = 0;
    for (const order of orders) {
      if (order.status === 'cancelled') continue;
      count += 1;
      for (const line of order.lines) {
        sold.set(line.itemId, (sold.get(line.itemId) ?? 0) + line.qty);
      }
    }
    return { orders: count, sold };
  }, [orders]);
}
