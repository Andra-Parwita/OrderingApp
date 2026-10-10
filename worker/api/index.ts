// The Worker's request handling (stage 8.4a, D-047), apart from the Durable Object export so unit
// tests can run it: the Origin check, the health answer, seller images, then the API on D1. The
// repository is built from the bindings once per request; nothing is kept between requests.
import { appVersion } from '../../shared/buildInfo';
import type { HealthResponse } from '../../shared/health';
import { checkOrigin } from '../auth/origin';
import { createD1Repository } from '../db';
import { Db, type D1Like } from '../db/d1';
import { createPushDispatcher } from '../push/dispatch';
import { createWebPushSender, realVapidValue, vapidFromEnv, type PushSender } from '../push/sender';
import { handleKitchenRequest } from './kitchenRoutes';
import type { ImageBucket } from '../images/r2';
import { serveImage } from '../images/serve';
import { createLiveNotifier, type RoomNamespace } from '../live/notifier';
import { handleApiRequest } from './routes';

/** The bindings and variables the Worker reads (wrangler.jsonc, `.dev.vars` locally). */
export type ApiEnv = {
  DB: D1Like;
  IMAGES: ImageBucket;
  SELLER_LIVE: RoomNamespace;
  /** Secret: the key that creates the first admin. Without it nobody can. */
  ADMIN_SETUP_KEY?: string;
  /** "1" turns every dev-only path on. Set only in `.dev.vars`; absent is production. */
  DEV_TOOLS?: string;
  /** Web push (plan 004 stage 6): the VAPID key pair and contact. Without them push is off. */
  VAPID_PUBLIC_KEY?: string;
  /** Secret. */
  VAPID_PRIVATE_KEY?: string;
  /** A `mailto:` or https URL the push services can reach the operator at. */
  VAPID_SUBJECT?: string;
};

/** Where the Worker hands work that may finish after the answer (`ExecutionContext`). */
export type WaitUntil = { waitUntil(promise: Promise<unknown>): void };

/** Test seams: a stand-in push sender. */
export type WorkerDeps = { pushSender?: PushSender };

export function devToolsOn(env: Pick<ApiEnv, 'DEV_TOOLS'>): boolean {
  return env.DEV_TOOLS === '1';
}

export async function handleWorkerRequest(
  request: Request,
  env: ApiEnv,
  ctx?: WaitUntil,
  deps: WorkerDeps = {},
): Promise<Response> {
  // The Origin check sits at the door, so every route behind it is covered.
  const refused = checkOrigin(request);
  if (refused) return refused;
  const devTools = devToolsOn(env);
  const { pathname } = new URL(request.url);
  if (pathname === '/api/health' && request.method === 'GET') {
    // `devTools` lets the app ask the server instead of guessing from its own build.
    const body: HealthResponse = {
      status: 'ok',
      time: new Date().toISOString(),
      devTools,
      version: appVersion(),
    };
    return Response.json(body);
  }
  // Seller images stream from R2: public, content-hashed, cached for a year (stage 8.3).
  const image = await serveImage(env.IMAGES, request);
  if (image) return image;
  // Web push: writes that tell customers something are collected, then sent after the answer is
  // ready (never inside the D1 write). Without VAPID keys nothing is sent.
  const vapid = vapidFromEnv(env);
  const dispatcher = createPushDispatcher({
    db: new Db(env.DB),
    sender: deps.pushSender ?? (vapid ? createWebPushSender(vapid) : undefined),
  });
  const repo = createD1Repository(env.DB, {
    now: () => new Date(),
    // A missing secret must never become a key anyone can guess: use one nobody knows.
    adminSetupKey: env.ADMIN_SETUP_KEY ?? crypto.randomUUID(),
    devTools,
    onCustomerChange: dispatcher.collect,
  });
  // The kitchen's manifest and icons (public, cacheable).
  const kitchenFile = await handleKitchenRequest(repo, request, { images: env.IMAGES });
  if (kitchenFile) return kitchenFile;
  const response = await handleApiRequest(repo, request, {
    live: createLiveNotifier(env.SELLER_LIVE),
    images: env.IMAGES,
    devTools,
    vapidPublicKey: realVapidValue(env.VAPID_PUBLIC_KEY),
  });
  const sending = dispatcher.flush();
  if (ctx) ctx.waitUntil(sending);
  else await sending;
  return response ?? new Response('Not found', { status: 404 });
}
