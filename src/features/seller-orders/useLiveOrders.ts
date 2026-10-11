import { useSelector } from 'react-redux';
import type { Order } from '../../../shared/domain';
import { useOrdersPolling } from './ordersShared';
import { selectList, selectOrders } from './sellerOrdersSelectors';

/**
 * The live menu's orders for Home (plan 039): starts the same polling the Orders screen uses.
 * `null` until the first load has finished.
 */
export function useLiveOrders(): ReadonlyArray<Order> | null {
  useOrdersPolling();
  const ready = useSelector(selectList).status === 'ready';
  const orders = useSelector(selectOrders);
  return ready ? orders : null;
}
