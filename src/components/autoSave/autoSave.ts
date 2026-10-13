import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type MutableRefObject,
} from 'react';
import { clearDraft, readDraft, writeDraft } from '../draft';

// Plan 072: tick freely, saved in one go. The change shows at once; one request follows ~1 s after
// the last change, carrying the whole current state. One request in flight; changes made meanwhile
// go right after it (the latest state wins). A save that did not get through keeps the pending
// state on this device (plan 061 drafts) and waits for the next change, Try again or the
// connection coming back (plan 062): never an endless loop.
//
// The saver is a plain object outside React, so a save started when a step closes still finishes
// (and clears or keeps the draft) after the step has gone.
//
// Plan 073: moved here from seller-menu; the Cook screen's made counts and the Pack ticks use it too.

export const AUTOSAVE_DELAY_MS = 1000;

export type SaveResult =
  | { ok: true; removedWithOrders?: number }
  /** `refused`: the server said no (undo the change); otherwise nothing got through (keep it). */
  | { ok: false; refused: boolean; code: string };

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'refused';

export type AutoSaveState<T> = Readonly<{
  /** The state the seller made and the server has not confirmed yet; null when there is none. */
  pending: T | null;
  status: SaveStatus;
  /** The refusal or failure code of the last save. */
  code: string | null;
  /** Dishes dropped although they have orders, from the last save. */
  removedWithOrders: number;
  /** Bumps when a refusal undoes the pending state, so inputs that kept their own text start over. */
  revision: number;
}>;

/** What a screen needs to ask before it lets the seller go. */
export type Leavable = {
  flushIfDue: () => void;
  retry: () => void;
  hasFailed: () => boolean;
};

/** Codes that mean "nothing reached the server's rules": keep the change and try again later. */
const KEPT_CODES: ReadonlyArray<string> = [
  'network',
  'bad_response',
  'maintenance',
  'unauthorized',
  'bad_origin',
  'kitchen_paused',
  'kitchen_closed',
];
export const isKeptCode = (code: string): boolean => KEPT_CODES.includes(code);

const registry = new Map<string, unknown>();

export class AutoSaver<T> implements Leavable {
  private state: AutoSaveState<T>;
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private queued = false;
  private version = 0;
  private attached = false;
  private sendFn: (value: T) => Promise<SaveResult>;

  constructor(
    readonly key: string,
    send: (value: T) => Promise<SaveResult>,
    private readonly delayMs = AUTOSAVE_DELAY_MS,
  ) {
    this.sendFn = send;
    // A draft left by a save that did not get through (or a closed tab): not saved yet.
    const found = readDraft<T>(key);
    this.state = {
      pending: found ? found.value : null,
      status: found ? 'failed' : 'idle',
      code: found ? 'network' : null,
      removedWithOrders: 0,
      revision: 0,
    };
  }

  setSend(send: (value: T) => Promise<SaveResult>): void {
    this.sendFn = send;
  }

  getState = (): AutoSaveState<T> => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.attach();
    return () => {
      this.listeners.delete(listener);
      this.maybeDetach();
    };
  };

  /** A change: shows at once; one save follows after a pause. */
  update = (change: (previous: T | null) => T): void => {
    const next = change(this.state.pending);
    this.version += 1;
    writeDraft(this.key, next, '');
    this.emit({ pending: next, status: 'saving', code: null, removedWithOrders: 0 });
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.fire();
    }, this.delayMs);
  };

  /** Save what is pending now, without waiting for the pause (also Try again). */
  flushNow = (): void => {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.fire();
  };

  /** Leaving a step, the page being hidden: save pending changes, but never retry a failure. */
  flushIfDue = (): void => {
    if (this.state.status !== 'failed') this.flushNow();
  };

  retry = (): void => this.flushNow();

  /** Resolves once nothing is waiting or in flight (also after a failure): "Mark packed" waits for it. */
  whenIdle = (): Promise<void> =>
    new Promise((resolve) => {
      const check = (): boolean => {
        if (this.inFlight || this.timer !== null || this.queued) return false;
        this.listeners.delete(check);
        resolve();
        return true;
      };
      if (!check()) this.listeners.add(check);
    });

  hasFailed = (): boolean => this.state.status === 'failed';

  private fire(): void {
    if (this.state.pending === null) return;
    if (this.inFlight) this.queued = true;
    else void this.run();
  }

  private async run(): Promise<void> {
    const sent = this.version;
    const value = this.state.pending as T;
    this.inFlight = true;
    this.queued = false;
    this.emit({ status: 'saving' });
    let result: SaveResult;
    try {
      result = await this.sendFn(value);
    } catch {
      result = { ok: false, refused: false, code: 'network' };
    }
    this.inFlight = false;
    const newer = this.version !== sent;
    if (result.ok && !newer) {
      this.queued = false;
      clearDraft(this.key);
      this.emit({
        pending: null,
        status: 'saved',
        code: null,
        removedWithOrders: result.removedWithOrders ?? 0,
      });
      this.maybeDetach();
      return;
    }
    if (!result.ok && result.refused) {
      // The server said no: the ticks go back to what the server holds, and the seller is told why.
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
      this.queued = false;
      clearDraft(this.key);
      this.emit({
        pending: null,
        status: 'refused',
        code: result.code,
        revision: this.state.revision + 1,
      });
      this.maybeDetach();
      return;
    }
    if (newer) {
      // Changes made while it flew: they go next (at once when asked to, else after the pause).
      if (result.ok) this.emit({ removedWithOrders: result.removedWithOrders ?? 0 });
      if (this.queued) {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        void this.run();
      } else this.emit({ status: 'saving' });
      return;
    }
    // Nothing got through: keep it on this device and wait for the next change / Try again / online.
    this.queued = false;
    this.emit({ status: 'failed', code: result.ok ? null : result.code });
  }

  private emit(patch: Partial<AutoSaveState<T>>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private readonly onOnline = (): void => {
    if (this.state.status === 'failed') this.flushNow();
  };
  private readonly onHide = (): void => {
    if (document.visibilityState === 'hidden') this.flushIfDue();
  };

  private attach(): void {
    if (this.attached) return;
    this.attached = true;
    registry.set(this.key, this);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('pagehide', this.flushIfDue);
    document.addEventListener('visibilitychange', this.onHide);
  }

  /** Tests only: forget this saver (timers, listeners, registry). */
  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
    this.state = { ...this.state, pending: null };
    this.inFlight = false;
    this.maybeDetach();
  }

  private maybeDetach(): void {
    if (!this.attached || this.state.pending !== null || this.inFlight || this.listeners.size > 0) {
      return;
    }
    this.attached = false;
    if (registry.get(this.key) === this) registry.delete(this.key);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('pagehide', this.flushIfDue);
    document.removeEventListener('visibilitychange', this.onHide);
  }
}

/** Tests only: forget every saver, so one test does not leave a request in flight for the next. */
export function forgetAutoSavers(): void {
  [...registry.values()].forEach((saver) => (saver as AutoSaver<unknown>).dispose());
  registry.clear();
}

/** The saver for this key: the one still saving from an earlier mount, or a new one. */
function acquireSaver<T>(key: string, send: (value: T) => Promise<SaveResult>): AutoSaver<T> {
  return (registry.get(key) as AutoSaver<T> | undefined) ?? new AutoSaver<T>(key, send);
}

/** The wizard collects the savers of the step on screen, to ask before it lets the seller leave. */
export const AutoSaveGate = createContext<MutableRefObject<Set<Leavable>> | null>(null);

export function useAutoSave<T>(
  key: string,
  send: (value: T) => Promise<SaveResult>,
): {
  state: AutoSaveState<T>;
  update: (change: (previous: T | null) => T) => void;
  flushNow: () => void;
  retry: () => void;
  whenIdle: () => Promise<void>;
} {
  const saver = useMemo(
    () =>
      acquireSaver<T>(key, () => Promise.resolve({ ok: false, refused: false, code: 'network' })),
    [key],
  );
  // The latest send (it closes over the store and the kitchen) is set after every render.
  useEffect(() => {
    saver.setSend(send);
  });
  const state = useSyncExternalStore(saver.subscribe, saver.getState);
  const gate = useContext(AutoSaveGate);
  useEffect(() => {
    const savers = gate?.current;
    savers?.add(saver);
    return () => {
      savers?.delete(saver);
    };
  }, [gate, saver]);
  // The step goes away (tab, Edit, Continue, Close, another screen): save what is pending now.
  useEffect(() => () => saver.flushIfDue(), [saver]);
  return {
    state,
    update: saver.update,
    flushNow: saver.flushNow,
    retry: saver.retry,
    whenIdle: saver.whenIdle,
  };
}
