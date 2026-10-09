// The Worker's request handling (stage 8.4a, D-047), apart from the Durable Object export so unit
// tests can run it: the Origin check, the health answer, seller images, then the API on D1. The
// repository is built from the bindings once per request; nothing is kept between requests.
import type { HealthResponse } from '../../shared/health';
import { checkOrigin } from '../auth/origin';
import { createD1Repository } from '../db';
import type { D1Like } from '../db/d1';
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
};

export function devToolsOn(env: Pick<ApiEnv, 'DEV_TOOLS'>): boolean {
  return env.DEV_TOOLS === '1';
}

export async function handleWorkerRequest(request: Request, env: ApiEnv): Promise<Response> {
  // The Origin check sits at the door, so every route behind it is covered.
  const refused = checkOrigin(request);
  if (refused) return refused;
  const devTools = devToolsOn(env);
  const { pathname } = new URL(request.url);
  if (pathname === '/api/health' && request.method === 'GET') {
    // `devTools` lets the app ask the server instead of guessing from its own build.
    const body: HealthResponse = { status: 'ok', time: new Date().toISOString(), devTools };
    return Response.json(body);
  }
  // Seller images stream from R2: public, content-hashed, cached for a year (stage 8.3).
  const image = await serveImage(env.IMAGES, request);
  if (image) return image;
  const repo = createD1Repository(env.DB, {
    now: () => new Date(),
    // A missing secret must never become a key anyone can guess: use one nobody knows.
    adminSetupKey: env.ADMIN_SETUP_KEY ?? crypto.randomUUID(),
    devTools,
  });
  const response = await handleApiRequest(repo, request, {
    live: createLiveNotifier(env.SELLER_LIVE),
    images: env.IMAGES,
    devTools,
  });
  return response ?? new Response('Not found', { status: 404 });
}
