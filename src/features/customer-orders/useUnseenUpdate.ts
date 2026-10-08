import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { hasUnseenUpdate } from '../../api/device/myOrders';
import { selectList } from './selectors';
import { listRequested } from './slice';

/**
 * True when any of this device's orders has an update the customer has not seen (the dot on the
 * My orders tab). It refreshes the list whenever `refreshKey` changes, e.g. the page.
 */
export function useUnseenUpdate(refreshKey: string): boolean {
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  useEffect(() => {
    dispatch(listRequested());
  }, [dispatch, refreshKey]);
  if (list.status !== 'ready') return false;
  return list.orders.some((order) =>
    hasUnseenUpdate(
      order,
      list.saved.find((entry) => entry.token === order.token),
    ),
  );
}
