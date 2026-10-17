// The logic of a seller's live room, free of Workers types so it can be unit-tested (stage 8.3).
// SellerLive.ts wires it to the Durable Object; routes only see `LiveNotifier`.
import { liveEventOf, parseLiveSignal, type LiveSignal } from '../../shared/liveContract';

/** What the routes use: tell a seller's room something changed, or hand it a socket. */
export type LiveNotifier = {
  /** Fire-and-forget from the caller's view; must never throw into a request that already wrote. */
  notify(sellerId: string, signal: LiveSignal): Promise<void>;
  /** Passes a WebSocket upgrade request to the seller's room; answers 101 with the socket. */
  connect(sellerId: string): Promise<Response>;
  /**
   * Plan 074: a customer's socket. `codes` are the order codes the Worker already checked against
   * the customer's private tokens (same kitchen, active); the room sends that socket only events
   * for those orders.
   */
  connectCustomer(sellerId: string, codes: ReadonlyArray<string>): Promise<Response>;
};

/** The one thing a room needs from a socket. */
export type SocketLike = { send(data: string): void };

/**
 * Sends one event to every socket and returns how many received it. A socket that throws (it
 * closed while the room was hibernating) is skipped; the runtime drops it on its own close event.
 */
export function broadcast(sockets: Iterable<SocketLike>, signal: LiveSignal, now: Date): number {
  const frame = JSON.stringify(liveEventOf(signal, now));
  let sent = 0;
  for (const socket of sockets) {
    try {
      socket.send(frame);
      sent += 1;
    } catch {
      // closed under us: nothing to do
    }
  }
  return sent;
}

/** A customer's socket and the order codes it was admitted with (plan 074). */
export type CustomerSocketLike = SocketLike & { codes: ReadonlyArray<string> };

/**
 * Plan 074: tells customers' sockets that one of THEIR orders changed. Only `order.changed` goes to
 * customers; with a code, only to sockets admitted with that code; a change without a code (many
 * orders moved at once) is a bare nudge to every customer socket of the kitchen, so each phone
 * refetches its own orders through the normal token-checked API. The frame is the same code-and-time
 * nudge the seller gets: no names, no phones, no other customer's anything.
 */
export function broadcastToCustomers(
  sockets: Iterable<CustomerSocketLike>,
  signal: LiveSignal,
  now: Date,
): number {
  if (signal.type === 'notice') return broadcast(sockets, signal, now);
  if (signal.type !== 'order.changed') return 0;
  // Never the writer's device id: that is for the seller's own screens only.
  const forCustomers: LiveSignal = { type: signal.type };
  if (signal.code !== undefined) forCustomers.code = signal.code;
  const frame = JSON.stringify(liveEventOf(forCustomers, now));
  let sent = 0;
  for (const socket of sockets) {
    if (signal.code !== undefined && !socket.codes.includes(signal.code)) continue;
    try {
      socket.send(frame);
      sent += 1;
    } catch {
      // closed under us: nothing to do
    }
  }
  return sent;
}

/** Reads the body of a notify call; null for anything that is not a known signal. */
export async function readSignal(request: Request): Promise<LiveSignal | null> {
  try {
    return parseLiveSignal(await request.json());
  } catch {
    return null;
  }
}
