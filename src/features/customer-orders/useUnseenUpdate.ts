import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { hasUnseenUpdate, readMyOrders } from '../../api/device/myOrders';
import { selectList } from './selectors';
import { listRequested } from './slice';

/**
 * True when any of this device's orders has an update the customer has not seen (the dot on the
 * My orders tab). The list loads once when the app opens; after that it follows the live connection
 * (plan 074), not every page change. "Seen" is read fresh from the phone on each render, so opening
 * an order clears its dot at once.
 */
export function useUnseenUpdate(): boolean {
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  useEffect(() => {
    dispatch(listRequested());
  }, [dispatch]);
  if (list.status !== 'ready') return false;
  const saved = readMyOrders();
  return list.orders.some((order) =>
    hasUnseenUpdate(
      order,
      saved.find((entry) => entry.token === order.token),
    ),
  );
}
