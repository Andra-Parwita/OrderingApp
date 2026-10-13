// The customer app's one live connection (plan 074). Mounted once in the shell (CustomerLiveHost),
// never per page. For each kitchen where this phone has an active order (not collected, delivered,
// cancelled or from a closed week) it keeps one WebSocket open, scoped by the orders' private
// tokens, so the server pushes only this customer's own order changes. Pages never talk to it: a
// change becomes one targeted refresh (or, for a bare nudge, one list refresh) and the pages read
// the store as before.
//
// Backup: only while the connection is down, a slow check every `backupMinutes.customer` minutes
// (from /api/status, 5 when absent) through startOrderPoll, which keeps plan 062's rules (pauses
// while hidden, backs off after failures, stops after repeated refusals until Try again). An instant
// check when the app comes back after a while and when the connection returns. Nothing runs when no
// order is active.
import { TOKENS_MAX } from '../../../shared/limits';
import { activeOrders, MY_ORDERS_CHANGED, type SavedOrder } from '../../api/device/myOrders';
import { connectLive, type LiveConnection, type SocketLike } from '../../api/live';
import { setCustomerLiveState, type LiveMode } from '../../api/customerLiveState';
import { startOrderPoll } from './orderPoll';

/** Events and notifications for one order closer together than this collapse into one refresh. */
export const REFRESH_WINDOW_MS = 1000;
/** Returning to the app sooner than this needs no check: nothing was missed. */
export const AWAY_CHECK_MS = 10_000;

export type CustomerLiveDeps = {
  createSocket: (url: string) => SocketLike;
  /** The backup gap in minutes (the server's setting); 5 when it cannot be read. */
  backupMinutes: () => Promise<number>;
  /** Reload one order (and patch it into the list). */
  refreshOrder: (token: string) => void;
  /** Reload everything this phone knows (the list; the order page follows it). */
  refreshAll: () => void;
  now?: () => number;
};

type Link = 'connecting' | 'live' | 'down';
type Room = {
  slug: string;
  /** The tokens the socket was opened with: a different set means a new socket. */
  key: string;
  link: Link;
  /** Lost at least once: coming back needs a check, since events may have been missed. */
  wasDown: boolean;
  connection: LiveConnection | null;
};

function liveUrl(slug: string, tokens: ReadonlyArray<string>): string {
  const url = new URL(`/api/s/${encodeURIComponent(slug)}/live`, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('tokens', tokens.join(','));
  return url.toString();
}

function groupBySlug(orders: ReadonlyArray<SavedOrder & { sellerSlug: string }>) {
  const bySlug = new Map<string, Array<SavedOrder>>();
  for (const order of orders) {
    const list = bySlug.get(order.sellerSlug) ?? [];
    if (list.length < TOKENS_MAX) list.push(order);
    bySlug.set(order.sellerSlug, list);
  }
  return bySlug;
}

/** The token in a notification's address (`/o/<token>`), if it is one. */
export function tokenOfOrderUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  return /^\/o\/([^/?#]+)/.exec(url)?.[1] ?? null;
}

/** Starts the connection manager; returns the way to stop it. */
export function startCustomerLive(deps: CustomerLiveDeps): () => void {
  const now = deps.now ?? Date.now;
  const rooms = new Map<string, Room>();
  let stopBackup: (() => void) | null = null;
  let backupStarting = false;
  let hiddenAt: number | null = null;
  let lastAll = Number.NEGATIVE_INFINITY;
  const orderTimers = new Map<string, { last: number; trailing?: ReturnType<typeof setTimeout> }>();
  let stopped = false;

  // One refresh per order per window: the first goes at once, anything inside the window becomes a
  // single trailing refresh (a second real change is never lost).
  const refreshOrder = (token: string) => {
    const entry = orderTimers.get(token) ?? { last: Number.NEGATIVE_INFINITY };
    orderTimers.set(token, entry);
    const wait = entry.last + REFRESH_WINDOW_MS - now();
    if (wait <= 0) {
      entry.last = now();
      deps.refreshOrder(token);
    } else if (entry.trailing === undefined) {
      entry.trailing = setTimeout(() => {
        entry.trailing = undefined;
        entry.last = now();
        if (!stopped) deps.refreshOrder(token);
      }, wait);
    }
  };

  // "Check now" requests (timer, return, reconnect) inside the window are the same check.
  const refreshAll = () => {
    if (now() - lastAll < REFRESH_WINDOW_MS) return;
    lastAll = now();
    deps.refreshAll();
  };

  const modeOf = (): LiveMode => {
    if (rooms.size === 0) return 'none';
    const links = [...rooms.values()].map((room) => room.link);
    if (links.includes('down')) return 'backup';
    return links.every((link) => link === 'live') ? 'live' : 'connecting';
  };

  const endBackup = () => {
    backupStarting = false;
    stopBackup?.();
    stopBackup = null;
  };

  function update() {
    const mode = modeOf();
    setCustomerLiveState({ mode });
    if (mode !== 'backup') {
      endBackup();
      return;
    }
    if (stopBackup !== null || backupStarting) return;
    backupStarting = true;
    void deps.backupMinutes().then((minutes) => {
      if (stopped || !backupStarting || stopBackup !== null || modeOf() !== 'backup') return;
      backupStarting = false;
      setCustomerLiveState({ minutes });
      stopBackup = startOrderPoll(refreshAll, minutes * 60_000);
    });
  }

  function open(slug: string, orders: ReadonlyArray<SavedOrder>) {
    const tokens = orders.map((order) => order.token);
    const room: Room = {
      slug,
      key: [...tokens].sort().join(','),
      link: 'connecting',
      wasDown: false,
      connection: null,
    };
    rooms.set(slug, room);
    const codeToken = new Map(orders.map((order) => [order.code, order.token]));
    room.connection = connectLive({
      url: () => liveUrl(slug, tokens),
      createSocket: deps.createSocket,
      onEvent: (event) => {
        const token = event.code === undefined ? undefined : codeToken.get(event.code);
        if (token !== undefined) refreshOrder(token);
        else refreshAll();
      },
      onStatus: (status) => {
        if (rooms.get(slug) !== room) return;
        const before = room.link;
        room.link = status === 'live' ? 'live' : status === 'connecting' ? 'connecting' : 'down';
        if (room.link === 'down') room.wasDown = true;
        if (room.link === 'live' && room.wasDown && before !== 'live') {
          room.wasDown = false;
          refreshAll();
        }
        update();
      },
    });
  }

  function sync() {
    if (stopped) return;
    const wanted = groupBySlug(activeOrders());
    for (const [slug, room] of [...rooms]) {
      const orders = wanted.get(slug);
      const key = orders
        ? orders
            .map((order) => order.token)
            .sort()
            .join(',')
        : null;
      if (key !== room.key) {
        room.connection?.close();
        rooms.delete(slug);
      }
    }
    for (const [slug, orders] of wanted) if (!rooms.has(slug)) open(slug, orders);
    update();
  }

  const onVisibility = () => {
    if (document.hidden) {
      hiddenAt = now();
      return;
    }
    const away = hiddenAt === null ? 0 : now() - hiddenAt;
    hiddenAt = null;
    if (rooms.size > 0 && away >= AWAY_CHECK_MS) refreshAll();
  };

  const onServiceWorker = (message: MessageEvent) => {
    const data: unknown = message.data;
    if (typeof data !== 'object' || data === null) return;
    const { type, url } = data as { type?: unknown; url?: unknown };
    if (type !== 'order-push') return;
    const token = tokenOfOrderUrl(url);
    if (token !== null) refreshOrder(token);
  };

  window.addEventListener(MY_ORDERS_CHANGED, sync);
  window.addEventListener('storage', sync);
  document.addEventListener('visibilitychange', onVisibility);
  const worker = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
  worker?.addEventListener('message', onServiceWorker);
  sync();

  return () => {
    stopped = true;
    window.removeEventListener(MY_ORDERS_CHANGED, sync);
    window.removeEventListener('storage', sync);
    document.removeEventListener('visibilitychange', onVisibility);
    worker?.removeEventListener('message', onServiceWorker);
    for (const room of rooms.values()) room.connection?.close();
    rooms.clear();
    for (const entry of orderTimers.values()) clearTimeout(entry.trailing);
    endBackup();
    setCustomerLiveState({ mode: 'none' });
  };
}
