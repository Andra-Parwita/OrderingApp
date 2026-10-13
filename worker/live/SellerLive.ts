// One Durable Object per seller (stage 8.3, D-046): the seller's live room. Seller screens connect
// a WebSocket; every order or menu write tells the room, and the room pushes a small "something
// changed" event to every open screen (they then refetch). It uses the WebSocket Hibernation API,
// so an idle room costs nothing: the object is evicted while the sockets stay open.
//
// The free plan only allows SQLite-backed Durable Objects (wrangler.jsonc `new_sqlite_classes`).
// The room keeps no data of its own: the sockets are all the state, and the runtime keeps them.
import { DurableObject } from 'cloudflare:workers';
import { LIVE_PING, LIVE_PONG } from '../../shared/liveContract';
import { broadcast, broadcastToCustomers, readSignal } from './hub';
import { TOKENS_MAX } from '../../shared/limits';

/** 1005/1006 may not be sent in a close frame; 1000 is the plain "done". */
const NORMAL_CLOSE = 1000;

// ---- Plan 074, customer sockets (kept apart from the seller's room above) ----
/** Customer sockets carry this tag; seller sockets have none. */
const CUSTOMER_TAG = 'customer';
/** A kitchen has 10 to 50 orders a menu: this is far above that and keeps the room bounded. */
const CUSTOMER_SOCKETS_MAX = 300;

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
      const now = new Date();
      // Seller screens get every event; customers' sockets (plan 074) only their own orders'.
      const sellers = this.ctx.getWebSockets().filter((ws) => !this.isCustomer(ws));
      const sent = broadcast(sellers, signal, now);
      const customers = this.ctx.getWebSockets(CUSTOMER_TAG).map((ws) => ({
        send: (data: string) => ws.send(data),
        codes: this.codesOf(ws),
      }));
      return Response.json({ sent, customers: broadcastToCustomers(customers, signal, now) });
    }

    // Plan 057: the daily translation cap. The key holds today's count; older days are removed.
    if (pathname === '/translate-slot' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as {
        day?: unknown;
        cap?: unknown;
      } | null;
      if (typeof body?.day !== 'string' || typeof body.cap !== 'number') {
        return new Response('Bad request', { status: 400 });
      }
      const key = `translate:${body.day}`;
      const used = (await this.ctx.storage.get<number>(key)) ?? 0;
      if (used >= body.cap) return Response.json({ ok: false });
      const old = [...(await this.ctx.storage.list({ prefix: 'translate:' })).keys()].filter(
        (k) => k !== key,
      );
      if (old.length > 0) await this.ctx.storage.delete(old);
      await this.ctx.storage.put(key, used + 1);
      return Response.json({ ok: true });
    }

    if (pathname === '/connect' && request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    // Plan 074: the Worker has already checked the customer's private tokens against this kitchen
    // and kept only active orders; it passes the order codes it admitted. A customer socket can
    // only ever hear about those.
    if (pathname === '/connect-customer' && request.headers.get('Upgrade') === 'websocket') {
      const codes = (new URL(request.url).searchParams.get('codes') ?? '')
        .split(',')
        .filter((code) => code !== '')
        .slice(0, TOKENS_MAX);
      if (codes.length === 0) return new Response('No orders', { status: 400 });
      if (this.ctx.getWebSockets(CUSTOMER_TAG).length >= CUSTOMER_SOCKETS_MAX) {
        return new Response('Busy', { status: 503 });
      }
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server, [CUSTOMER_TAG]);
      server.serializeAttachment({ codes });
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Expected a WebSocket', { status: 426 });
  }

  private isCustomer(ws: WebSocket): boolean {
    return this.ctx.getTags(ws).includes(CUSTOMER_TAG);
  }

  private codesOf(ws: WebSocket): ReadonlyArray<string> {
    const attachment: unknown = ws.deserializeAttachment();
    const codes =
      typeof attachment === 'object' && attachment !== null
        ? (attachment as { codes?: unknown }).codes
        : undefined;
    return Array.isArray(codes)
      ? codes.filter((code): code is string => typeof code === 'string')
      : [];
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
