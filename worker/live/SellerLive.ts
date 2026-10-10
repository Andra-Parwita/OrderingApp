// One Durable Object per seller (stage 8.3, D-046): the seller's live room. Seller screens connect
// a WebSocket; every order or menu write tells the room, and the room pushes a small "something
// changed" event to every open screen (they then refetch). It uses the WebSocket Hibernation API,
// so an idle room costs nothing: the object is evicted while the sockets stay open.
//
// The free plan only allows SQLite-backed Durable Objects (wrangler.jsonc `new_sqlite_classes`).
// The room keeps no data of its own: the sockets are all the state, and the runtime keeps them.
import { DurableObject } from 'cloudflare:workers';
import { LIVE_PING, LIVE_PONG } from '../../shared/liveContract';
import { broadcast, readSignal } from './hub';

/** 1005/1006 may not be sent in a close frame; 1000 is the plain "done". */
const NORMAL_CLOSE = 1000;

export class SellerLive extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    // Answered by the runtime without waking the object, so heartbeats are free.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(LIVE_PING, LIVE_PONG));
  }

  override async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/notify' && request.method === 'POST') {
      const signal = await readSignal(request);
      if (!signal) return new Response('Bad event', { status: 400 });
      const sent = broadcast(this.ctx.getWebSockets(), signal, new Date());
      return Response.json({ sent });
    }

    if (pathname === '/connect' && request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Expected a WebSocket', { status: 426 });
  }

  // Clients only send the heartbeat text (answered by the auto-response above); anything else is
  // ignored: a socket is a one-way feed.
  override webSocketMessage(): void {
    // nothing to do
  }

  override webSocketClose(ws: WebSocket): void {
    try {
      ws.close(NORMAL_CLOSE, 'closed');
    } catch {
      // already closed
    }
  }

  override webSocketError(ws: WebSocket): void {
    try {
      ws.close(NORMAL_CLOSE, 'error');
    } catch {
      // already closed
    }
  }
}
