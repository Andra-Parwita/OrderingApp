import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchStatus } from '../../api/status';
import type { SocketLike } from '../../api/live';
import { startCustomerLive, type CustomerLiveDeps } from './liveConnection';
import { listRequested, orderLiveRequested } from './slice';

/** The gap used when /api/status cannot be read (also the server's own default). */
const DEFAULT_BACKUP_MINUTES = 5;

async function backupMinutes(): Promise<number> {
  const status = await fetchStatus();
  return status?.backupMinutes.customer ?? DEFAULT_BACKUP_MINUTES;
}

function defaultSocket(url: string, protocols?: Array<string>): SocketLike {
  return new WebSocket(url, protocols);
}

/**
 * Plan 074: mounted once in the customer shell. Opens the app's one live connection (see
 * liveConnection.ts) and turns what it hears into the store's normal reload actions. Renders
 * nothing. Under test it stays off unless a test hands it `deps`.
 */
export function CustomerLiveHost({ deps }: Readonly<{ deps?: Partial<CustomerLiveDeps> }>) {
  const dispatch = useDispatch();
  const injected = deps !== undefined;
  const createSocket = deps?.createSocket;
  const minutes = deps?.backupMinutes;
  const now = deps?.now;
  useEffect(() => {
    if (!injected && import.meta.env.MODE === 'test') return undefined;
    return startCustomerLive({
      createSocket: createSocket ?? defaultSocket,
      backupMinutes: minutes ?? backupMinutes,
      refreshOrder: (token) => dispatch(orderLiveRequested(token)),
      refreshAll: () => dispatch(listRequested()),
      ...(now ? { now } : {}),
    });
  }, [dispatch, injected, createSocket, minutes, now]);
  return null;
}
