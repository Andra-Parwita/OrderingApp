import { useSyncExternalStore } from 'react';
import { getNetSnapshot, watchNet } from '../../api/netState';

export type NetworkState = 'ok' | 'offline' | 'server' | 'stopped';

function watchAll(onChange: () => void): () => void {
  const stopNet = watchNet(onChange);
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    stopNet();
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

function read(): NetworkState {
  const { failing, stopped } = getNetSnapshot();
  if (stopped) return 'stopped';
  if (!navigator.onLine) return 'offline';
  return failing ? 'server' : 'ok';
}

/** What the person should be told about the connection: offline, server not answering, a poll that gave up, or nothing. */
export function useNetworkState(): NetworkState {
  return useSyncExternalStore(watchAll, read, () => 'ok');
}
