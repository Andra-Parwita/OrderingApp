// What the customer's live connection is doing right now (plan 074), for the one muted line in
// Settings. No imports, so any module can read or set it without a cycle.

/**
 * `none`: no active order on this phone, nothing is connected. `connecting`: the first attempt.
 * `live`: pushed updates arrive. `backup`: the connection is down; a slow check carries on.
 */
export type LiveMode = 'none' | 'connecting' | 'live' | 'backup';

export type CustomerLiveState = {
  mode: LiveMode;
  /** When the screens last received fresh data (ms since the epoch); null before the first. */
  lastUpdated: number | null;
  /** The backup check's gap, from the server's setting (plan 074). */
  minutes: number;
};

const INITIAL: CustomerLiveState = { mode: 'none', lastUpdated: null, minutes: 5 };

let state: CustomerLiveState = INITIAL;
const watchers = new Set<() => void>();

export function getCustomerLiveState(): CustomerLiveState {
  return state;
}

export function setCustomerLiveState(patch: Partial<CustomerLiveState>): void {
  const next = { ...state, ...patch };
  if (
    next.mode === state.mode &&
    next.lastUpdated === state.lastUpdated &&
    next.minutes === state.minutes
  ) {
    return;
  }
  state = next;
  for (const watcher of [...watchers]) watcher();
}

/** Calls `onChange` on every change; returns the way to stop. */
export function watchCustomerLiveState(onChange: () => void): () => void {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}

/** Fresh data reached the screens (a push, a check or a load). */
export function noteLiveUpdate(now: number = Date.now()): void {
  setCustomerLiveState({ lastUpdated: now });
}

/** Tests only. */
export function resetCustomerLiveState(): void {
  state = INITIAL;
  watchers.clear();
}
