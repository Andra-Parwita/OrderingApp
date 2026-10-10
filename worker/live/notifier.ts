// The Worker's side of the live room: finds the seller's Durable Object and talks to it.
import type { LiveSignal } from '../../shared/liveContract';
import type { LiveNotifier } from './hub';

/** The part of a Durable Object namespace that is used; the real binding fits it. */
export type RoomNamespace = {
  idFromName(name: string): unknown;
  get(id: never): { fetch(request: Request): Promise<Response> };
};

const CONNECT_URL = 'https://live.internal/connect';
const NOTIFY_URL = 'https://live.internal/notify';

export function createLiveNotifier(namespace: RoomNamespace): LiveNotifier {
  const room = (sellerId: string) => namespace.get(namespace.idFromName(sellerId) as never);
  return {
    async notify(sellerId, signal: LiveSignal) {
      try {
        await room(sellerId).fetch(
          new Request(NOTIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signal),
          }),
        );
      } catch {
        // The write already succeeded; a missed nudge is covered by the client's fallback polling.
      }
    },

    connect(sellerId) {
      // A fresh request: only the upgrade header goes through, never the client's URL or cookies.
      const upgrade = new Request(CONNECT_URL, { headers: { Upgrade: 'websocket' } });
      return room(sellerId).fetch(upgrade);
    },
  };
}
