// The logic of a seller's live room, free of Workers types so it can be unit-tested (stage 8.3).
// SellerLive.ts wires it to the Durable Object; routes only see `LiveNotifier`.
import { liveEventOf, parseLiveSignal, type LiveSignal } from '../../shared/liveContract';

/** What the routes use: tell a seller's room something changed, or hand it a socket. */
export type LiveNotifier = {
  /** Fire-and-forget from the caller's view; must never throw into a request that already wrote. */
  notify(sellerId: string, signal: LiveSignal): Promise<void>;
  /** Passes a WebSocket upgrade request to the seller's room; answers 101 with the socket. */
  connect(sellerId: string): Promise<Response>;
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

/** Reads the body of a notify call; null for anything that is not a known signal. */
export async function readSignal(request: Request): Promise<LiveSignal | null> {
  try {
    return parseLiveSignal(await request.json());
  } catch {
    return null;
  }
}
