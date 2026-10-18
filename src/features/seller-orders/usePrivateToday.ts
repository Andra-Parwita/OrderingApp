import { useCallback, useEffect, useState } from 'react';
import type { Order } from '../../../shared/domain';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { sellerDeviceId } from '../../api/deviceId';
import { subscribeLive } from '../../api/live';
import { fetchPrivate } from '../../api/private';

/**
 * Plan 081: the kitchen's private orders of today (not cancelled), kept out of the menu's lists and
 * stats. Loaded on mount, on `reload()` and when another device's live event arrives (or the
 * connection comes back); not on every change of the menu's orders list (plan 103).
 * An empty list while loading or when the call fails: the section just stays hidden.
 */
export function usePrivateToday(subscribe: typeof subscribeLive = subscribeLive): {
  orders: ReadonlyArray<Order>;
  reload: () => void;
} {
  const [orders, setOrders] = useState<ReadonlyArray<Order>>([]);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    void fetchPrivate({ day: 'today' }, currentSellerSlug()).then((result) => {
      if (live && result.ok) setOrders(result.data.orders);
    });
    return () => {
      live = false;
    };
  }, [attempt]);
  useEffect(() => {
    let connected = false;
    let wentDown = false;
    try {
      return subscribe({
        onEvent: (event) => {
          // This device's own change is reloaded by the caller (reload()).
          if (event.from !== undefined && event.from === sellerDeviceId()) return;
          if (event.type === 'order.created' || event.type === 'order.changed') reload();
        },
        onStatus: (status) => {
          if (status === 'reconnecting') wentDown = true;
          const wasConnected = connected;
          connected = status === 'live';
          if (connected && !wasConnected && wentDown) {
            wentDown = false;
            reload();
          }
        },
      });
    } catch {
      return undefined; // no live connection (tests): explicit reload() only
    }
  }, [subscribe, reload]);
  return { orders, reload };
}
