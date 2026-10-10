import { useEffect, useMemo, useState } from 'react';
import { fetchSellerOrders } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import type { SellerOrder } from '../../../shared/domain';

/** Order count and the quantity sold per menu dish, from the live orders (cancelled ones left out). */
export function useSold(enabled: boolean): { orders: number; sold: Map<string, number> } {
  const [orders, setOrders] = useState<Array<SellerOrder>>([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    void fetchSellerOrders(undefined, currentSellerSlug()).then((result) => {
      if (live && result.ok) setOrders(result.data.orders);
    });
    return () => {
      live = false;
    };
  }, [enabled]);
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
