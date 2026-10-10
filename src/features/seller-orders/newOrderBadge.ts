import { useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import { selectUnseenNew } from './sellerOrdersSelectors';
import type { SellerOrdersRootState } from './sellerOrdersSlice';

// Plan 021: what the seller shell shows about new orders: the Orders dot and the tab title.

const noSubscribe = () => () => undefined;

/** New customer orders not yet seen; 0 without a store (tests of the shell). */
export function useUnseenNewOrders(): number {
  const store = useContext(ReactReduxContext)?.store;
  const subscribe = useCallback(
    (onChange: () => void) => (store ? store.subscribe(onChange) : noSubscribe()),
    [store],
  );
  return useSyncExternalStore(subscribe, () =>
    store ? selectUnseenNew(store.getState() as SellerOrdersRootState) : 0,
  );
}

/** While the page is hidden and orders are unseen the title reads "(2) Orders · Kitchen". */
export function useNewOrderTitle(ordersLabel: string, kitchenName: string): void {
  const unseen = useUnseenNewOrders();
  useEffect(() => {
    if (unseen === 0) return undefined;
    const base = document.title;
    const sync = () => {
      document.title = document.hidden ? `(${unseen}) ${ordersLabel} · ${kitchenName}` : base;
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      document.title = base;
    };
  }, [unseen, ordersLabel, kitchenName]);
}
