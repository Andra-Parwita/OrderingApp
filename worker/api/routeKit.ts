// What every route module shares: the context the Worker hands the routes, the small response
// helpers, and the live "something changed" nudge. Plan 098 C1 split these out of routes.ts.
import type { ApiErrorCode, ApiWarning } from '../../shared/apiError';
import type { Chef, SellerMenuItemView, SellerOrder } from '../../shared/domain';
import type { LiveEventType } from '../../shared/liveContract';
import type { ChefResponse, ItemResponse, OkResponse } from '../../shared/setupContract';
import type { SellerOrderResponse } from '../../shared/orderContract';
import type { ImageBucket } from '../images/r2';
import type { LiveNotifier } from '../live/hub';
import type { MenuNoticeService } from '../push/menuNotice';
import type { Repository, StoreResult } from '../repo/Repository';
import { error } from './respond';
import type { TranslateContext } from './translate';

/** What the hosting Worker offers the routes. Both are optional: unit tests run without them. */
export type RouteContext = {
  /** The seller's live room (Durable Object, stage 8.3). */
  live?: LiveNotifier;
  /** Seller images in R2 (stage 8.3). Without it a seller's image stays a data URL in the store. */
  images?: ImageBucket;
  /**
   * Dev tools (the Worker var DEV_TOOLS === "1", set only in .dev.vars). Off or absent is how
   * production runs: the X-Seller / X-Actor override, the live-socket slug fallback and every
   * /api/dev/* route then answer as if they did not exist.
   */
  devTools?: boolean;
  /** The VAPID public key (env `VAPID_PUBLIC_KEY`); absent means web push is not set up. */
  vapidPublicKey?: string | undefined;
  /** Plan 057: the translator and its daily cap; absent means translation is unavailable. */
  translate?: TranslateContext;
  /** Plan 112: new-menu notices (customers turn them on, the owner sends); absent = the routes answer 404. */
  menuNotices?: MenuNoticeService;
  /** Plan 071 (D-099): the key for delivery addresses (secret `ADDRESS_KEY`); absent = addresses are off. */
  addressKey?: CryptoKey | null;
  /** Plan 071: the public Maps Embed key (env `MAPS_EMBED_KEY`); sent in the public menu answer when set. */
  mapsEmbedKey?: string;
  /** Plan 046: the release token (secret `MAINTENANCE_TOKEN`) that may switch maintenance on or off; absent = no such endpoint. */
  maintenanceToken?: string | undefined;
};

/** One request, split into the parts every area module reads. */
export type ApiCall = {
  store: Repository;
  request: Request;
  context: RouteContext;
  pathname: string;
  searchParams: URLSearchParams;
  /** The path after `/api/`: the area, then up to three more parts. */
  area: string | undefined;
  a: string | undefined;
  b: string | undefined;
  c: string | undefined;
  bad: () => Response;
};

export const noSeller = () => error('seller_not_found', 'Seller not found');
export const weekClosed = () => error('week_closed', 'This week is closed');
/** Plan 081: a customer may not change, cancel or collect a private order; the owner does, on WhatsApp's word. */
export const privateRefusal = () =>
  error('private_order', 'This is a private order: message the kitchen on WhatsApp to change it');
export const ownerOnly = () => error('forbidden', 'Only the owner can do this');

/**
 * A failed store call as an error response. A refusal the seller may override (D-062) carries its
 * `warning`; the same call with `force: true` goes ahead.
 */
export function refusal(result: {
  error: ApiErrorCode;
  message: string;
  warning?: ApiWarning | undefined;
}): Response {
  return error(result.error, result.message, result.warning ? { warning: result.warning } : {});
}

/** Seller endpoints return the full order. */
export function sellerResult(result: StoreResult<SellerOrder>, status = 200): Response {
  if (!result.ok) return refusal(result);
  const body: SellerOrderResponse = { order: result.value };
  return Response.json(body, { status });
}

export function safeParse(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return null;
  }
}

export function itemResult(result: StoreResult<SellerMenuItemView>, status = 200): Response {
  return result.ok
    ? Response.json({ item: result.value } satisfies ItemResponse, { status })
    : error(result.error, result.message);
}

export function chefResult(result: StoreResult<Chef>, status = 200): Response {
  return result.ok
    ? Response.json({ chef: result.value } satisfies ChefResponse, { status })
    : error(result.error, result.message);
}

export function okResult(result: StoreResult<true>): Response {
  return result.ok
    ? Response.json({ ok: true } satisfies OkResponse)
    : error(result.error, result.message);
}

/**
 * Tells a seller's live room that something changed, after the write has succeeded. Never throws
 * and never delays the answer for long: a missed nudge is covered by the screens' fallback polling.
 */
export async function signal(
  context: RouteContext,
  sellerId: string,
  type: LiveEventType,
  code?: string,
): Promise<void> {
  if (!context.live) return;
  try {
    await context.live.notify(sellerId, code === undefined ? { type } : { type, code });
  } catch {
    // see above
  }
}

/** Signals after a customer or seller order write that succeeded; passes the result through. */
export async function afterOrderWrite(
  context: RouteContext,
  sellerId: string,
  type: 'order.created' | 'order.changed',
  result: StoreResult<SellerOrder>,
): Promise<StoreResult<SellerOrder>> {
  if (result.ok) await signal(context, sellerId, type, result.value.code);
  return result;
}
