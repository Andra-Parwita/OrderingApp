import { useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import type { PrivateDue } from '../../../shared/privateContract';
import { dueCount } from './model';
import { pollingStarted, pollingStopped, type PrivateRootState } from './privateSlice';

// The live reloads run while at least one consumer (the rail, the phone bar, a Private screen) is
// mounted: each store counts them, the first starts the saga's loop and the last stops it.
const watchers = new WeakMap<object, number>();

const noSubscribe = () => () => undefined;
const NONE: PrivateDue = { today: 0, tomorrow: 0 };

/** Starts (and finally stops) the Private live reloads; does nothing without a store. */
export function usePrivatePolling(): void {
  const store = useContext(ReactReduxContext)?.store;
  useEffect(() => {
    if (!store) return undefined;
    const count = watchers.get(store) ?? 0;
    watchers.set(store, count + 1);
    if (count === 0) store.dispatch(pollingStarted());
    return () => {
      const left = (watchers.get(store) ?? 1) - 1;
      watchers.set(store, left);
      if (left === 0) store.dispatch(pollingStopped());
    };
  }, [store]);
}

/** Private orders due today and tomorrow (0 and 0 before the first load, or in a shell without the slice). */
export function usePrivateDue(): PrivateDue {
  usePrivatePolling();
  const store = useContext(ReactReduxContext)?.store;
  const subscribe = useCallback(
    (onChange: () => void) => (store ? store.subscribe(onChange) : noSubscribe()),
    [store],
  );
  return useSyncExternalStore(subscribe, () =>
    store ? ((store.getState() as Partial<PrivateRootState>).sellerPrivate?.due ?? NONE) : NONE,
  );
}

/** The small number on More and on the rail's Private item. */
export function usePrivateDueCount(): number {
  return dueCount(usePrivateDue());
}
