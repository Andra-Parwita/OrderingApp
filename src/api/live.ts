// Live updates, seller side (stage 8.3, D-046). One WebSocket per tab to the seller's Durable Object;
// the server pushes tiny "something changed" events (no customer data) and the screens refetch
// through the normal API. While the socket is down the screens fall back to slow polling.
//
// Phase 5 notes: the URL is the same on the real domain (wss on the Worker's host). Until stage 8.2
// the seller is named by a `?seller=` slug (a browser WebSocket cannot send headers); with the
// HttpOnly cookie session the browser sends the cookie with the upgrade itself, and the slug goes.
import { buffers, eventChannel, type EventChannel } from 'redux-saga';
import { call, delay, flush, race, take } from 'redux-saga/effects';
import { LIVE_PATH, LIVE_PING, parseLiveEvent, type LiveEvent } from '../../shared/liveContract';
import { currentSellerSlug } from './device/sellerContext';

/** `connecting`: first attempt; `live`: open; `reconnecting`: lost, waiting to try again. */
export type LiveStatus = 'connecting' | 'live' | 'reconnecting';

export type LiveListener = {
  onEvent: (event: LiveEvent) => void;
  onStatus: (status: LiveStatus) => void;
};

/** The parts of a WebSocket that are used, so tests can pass a fake. */
export type SocketLike = {
  send(data: string): void;
  close(): void;
  /** 0 while still connecting (a real WebSocket); fakes may leave it out. */
  readyState?: number;
  onopen: ((event: Event) => unknown) | null;
  onmessage: ((event: MessageEvent) => unknown) | null;
  onclose: ((event: CloseEvent) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
};

export type LiveConnectionOptions = {
  url: () => string;
  createSocket: (url: string) => SocketLike;
  random?: () => number;
  /** A ping goes out this often while open. */
  heartbeatMs?: number;
  /** No answer (any frame) this long after a ping: the socket is dead, reconnect. */
  heartbeatTimeoutMs?: number;
} & LiveListener;

export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30_000;
export const HEARTBEAT_MS = 25_000;
export const HEARTBEAT_TIMEOUT_MS = 10_000;

/** 1 s, 2 s, 4 s ... up to 30 s, each with up to a quarter taken off so screens do not reconnect in step. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return Math.round(base * (1 - 0.25 * random()));
}

export type LiveConnection = { close(): void };

/** Connects, reconnects with backoff, and pings. The first attempt is immediate. */
export function connectLive(options: LiveConnectionOptions): LiveConnection {
  const { createSocket, onEvent, onStatus } = options;
  const random = options.random ?? Math.random;
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? HEARTBEAT_TIMEOUT_MS;
  let socket: SocketLike | null = null;
  let attempt = 0;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let pingTimer: ReturnType<typeof setTimeout> | undefined;
  let deadTimer: ReturnType<typeof setTimeout> | undefined;

  const stopTimers = () => {
    clearTimeout(retryTimer);
    clearTimeout(pingTimer);
    clearTimeout(deadTimer);
  };

  const schedulePing = (current: SocketLike) => {
    pingTimer = setTimeout(() => {
      try {
        current.send(LIVE_PING);
      } catch {
        current.close();
        return;
      }
      deadTimer = setTimeout(() => {
        current.close();
      }, heartbeatTimeoutMs);
    }, heartbeatMs);
  };

  const lost = (current: SocketLike) => {
    if (socket !== current) return;
    socket = null;
    stopTimers();
    if (closed) return;
    onStatus('reconnecting');
    retryTimer = setTimeout(open, backoffMs(attempt, random));
    attempt += 1;
  };

  function open() {
    if (closed) return;
    let current: SocketLike;
    try {
      current = createSocket(options.url());
    } catch {
      // No WebSocket here (or a bad URL): behave like a lost connection and keep polling.
      socket = null;
      onStatus('reconnecting');
      retryTimer = setTimeout(open, backoffMs(attempt, random));
      attempt += 1;
      return;
    }
    socket = current;
    current.onopen = () => {
      if (socket !== current) return;
      attempt = 0;
      onStatus('live');
      schedulePing(current);
    };
    current.onmessage = (message) => {
      if (socket !== current) return;
      // Any frame proves the socket is alive; the pong is just text.
      clearTimeout(deadTimer);
      clearTimeout(pingTimer);
      schedulePing(current);
      if (typeof message.data !== 'string') return;
      const event = parseLiveEvent(message.data);
      if (event) onEvent(event);
    };
    current.onclose = () => {
      lost(current);
    };
    current.onerror = () => {
      // `close` follows an error; nothing to do here.
    };
  }

  onStatus('connecting');
  open();

  return {
    close() {
      closed = true;
      stopTimers();
      const current = socket;
      socket = null;
      if (current) {
        current.onopen = current.onmessage = current.onclose = current.onerror = null;
        // Closing a socket that is still connecting makes the browser log an error: wait for it to open.
        if (current.readyState === 0) current.onopen = () => current.close();
        else current.close();
      }
    },
  };
}

// ---- One shared connection per tab ----

let shared: LiveConnection | null = null;
let sharedStatus: LiveStatus = 'connecting';
const listeners = new Set<LiveListener>();

// ---- What the "Live" dot shows (stage 8.4b) ----

/**
 * `live`: the socket is open. `reconnecting`: it was lost or is still connecting, and is trying
 * again. `offline`: it failed OFFLINE_AFTER_FAILURES times in a row, so the screens are on their
 * slow polling fallback and updates arrive late.
 */
export type LiveLink = 'live' | 'reconnecting' | 'offline';
export const OFFLINE_AFTER_FAILURES = 3;

let link: LiveLink = 'reconnecting';
let failures = 0;
const linkWatchers = new Set<() => void>();

function setLink(next: LiveLink) {
  if (next === link) return;
  link = next;
  for (const watcher of [...linkWatchers]) watcher();
}

function trackLink(status: LiveStatus) {
  if (status === 'live') {
    failures = 0;
    setLink('live');
  } else if (status === 'reconnecting') {
    failures += 1;
    setLink(failures >= OFFLINE_AFTER_FAILURES ? 'offline' : 'reconnecting');
  }
  // 'connecting' is the first attempt: the link stays as it is (reconnecting at the start).
}

function resetLink() {
  failures = 0;
  setLink('reconnecting');
}

/** The current link, for `useSyncExternalStore`. */
export function getLiveLink(): LiveLink {
  return link;
}

/** Calls `onChange` whenever the link changes; returns the way to stop. */
export function watchLiveLink(onChange: () => void): () => void {
  linkWatchers.add(onChange);
  return () => {
    linkWatchers.delete(onChange);
  };
}

/** The socket URL for the current seller: wss on https pages, ws on http. */
export function liveUrl(): string {
  const url = new URL(LIVE_PATH, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('seller', currentSellerSlug());
  return url.toString();
}

/** Under test there is no server to connect to; tests pass their own socket factory. */
function defaultSocket(url: string): SocketLike {
  if (import.meta.env.MODE === 'test') throw new Error('No live socket under test');
  return new WebSocket(url);
}

/**
 * Listens to the seller's live events. The first subscriber opens the connection, the last one to
 * leave closes it, so the orders list and the cook screen share one socket.
 */
export function subscribeLive(
  listener: LiveListener,
  createSocket: (url: string) => SocketLike = defaultSocket,
): () => void {
  listeners.add(listener);
  if (shared === null) {
    sharedStatus = 'connecting';
    resetLink();
    shared = connectLive({
      url: liveUrl,
      createSocket,
      onEvent: (event) => {
        for (const each of [...listeners]) each.onEvent(event);
      },
      onStatus: (status) => {
        sharedStatus = status;
        trackLink(status);
        for (const each of [...listeners]) each.onStatus(status);
      },
    });
  } else {
    listener.onStatus(sharedStatus);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && shared !== null) {
      shared.close();
      shared = null;
      resetLink();
    }
  };
}

// ---- For sagas ----

export type LiveMessage =
  { kind: 'status'; status: LiveStatus } | { kind: 'event'; event: LiveEvent };

/** A saga channel of statuses and events. Closing it unsubscribes. */
export function liveChannel(
  subscribe: typeof subscribeLive = subscribeLive,
): EventChannel<LiveMessage> {
  return eventChannel<LiveMessage>((emit) => {
    return subscribe({
      onEvent: (event) => {
        emit({ kind: 'event', event });
      },
      onStatus: (status) => {
        emit({ kind: 'status', status });
      },
    });
  }, buffers.expanding(16));
}

export type LiveRefresh = {
  /** Loads the screen's data once. */
  load: () => Generator<unknown, void, unknown>;
  /** How long to wait between loads while the socket is not live (the fallback). */
  fallbackMs: number;
  /** The channel to listen to; tests pass one from a fake socket. */
  channel?: () => EventChannel<LiveMessage>;
};

/**
 * Keeps a screen fresh: loads once, then reloads on every live event (a burst is one reload), and
 * once more each time the socket (re)connects, since events may have been missed while it was
 * down. While the socket is not live it reloads every `fallbackMs`. Run it in a `race` against the
 * screen's "stop" action; closing the channel in `finally` closes the socket for the last screen.
 */
export function* liveRefreshLoop({ load, fallbackMs, channel = liveChannel }: LiveRefresh) {
  const messages = (yield call(channel)) as EventChannel<LiveMessage>;
  try {
    let live = false;
    yield call(load);
    while (true) {
      const { message, tick } = (yield race({
        message: take(messages),
        // Only while the socket is down; a live socket needs no timer at all.
        ...(live ? {} : { tick: delay(fallbackMs) }),
      })) as { message?: LiveMessage; tick?: true };
      let reload = tick !== undefined;
      const batch: Array<LiveMessage> = [];
      if (message) batch.push(message);
      if (message) batch.push(...((yield flush(messages)) as Array<LiveMessage>));
      for (const entry of batch) {
        if (entry.kind === 'status') {
          const wasLive = live;
          live = entry.status === 'live';
          if (live && !wasLive) reload = true;
        } else reload = true;
      }
      if (reload) yield call(load);
    }
  } finally {
    messages.close();
  }
}
