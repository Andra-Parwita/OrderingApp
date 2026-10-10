import { handleWorkerRequest, type ApiEnv } from './api';
import { withKitchenLinks } from './pages';
import { RETENTION_CRON, runAttemptSweep, runAutoFinish, runRetention } from './api/scheduled';
import type { SellerLive } from './live/SellerLive';

// Cloudflare finds a Durable Object class by its export from the Worker's main module.
export { SellerLive } from './live/SellerLive';

/** The bindings in wrangler.jsonc, plus the variables in `.dev.vars` (locally). */
type Env = Omit<ApiEnv, 'DB' | 'IMAGES' | 'SELLER_LIVE'> & {
  /** D1 (stage 8.1b). */
  DB: D1Database;
  /** One live room per seller (stage 8.3). */
  SELLER_LIVE: DurableObjectNamespace<SellerLive>;
  /** Seller images (stage 8.3). */
  IMAGES: R2Bucket;
  /** The built app (wrangler.jsonc `assets.binding`). */
  ASSETS: Fetcher;
};

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    // wrangler.jsonc sends every path but the hashed assets here. The API, images and kitchen files
    // are the Worker's own; everything else is a page or a static file from the assets.
    if (/^\/(api|k|images)\//.test(new URL(request.url).pathname)) {
      return handleWorkerRequest(request, env, ctx);
    }
    // No conditional headers: a 304 for the plain file would let a phone keep a page without (or with
    // another kitchen's) links.
    const headers = new Headers(request.headers);
    headers.delete('If-None-Match');
    headers.delete('If-Modified-Since');
    const page = await env.ASSETS.fetch(new Request(request, { headers }));
    return withKitchenLinks(request, env, page);
  },
  // The crons in wrangler.jsonc. Every run finishes the menus whose cooking day has ended (hourly);
  // the Monday 03:00 UTC run also does retention for every seller.
  scheduled: async (controller: ScheduledController, env: Env): Promise<void> => {
    const now = new Date();
    await runAutoFinish(env, now);
    await runAttemptSweep(env, now);
    if (controller.cron === RETENTION_CRON) await runRetention(env, now);
  },
} satisfies ExportedHandler<Env>;
