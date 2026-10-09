import { handleWorkerRequest, type ApiEnv } from './api';
import { runRetention } from './api/scheduled';
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
};

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleWorkerRequest(request, env),
  // The weekly cron in wrangler.jsonc (Monday 03:00 UTC): retention for every seller.
  scheduled: async (_controller: ScheduledController, env: Env): Promise<void> => {
    await runRetention(env, new Date());
  },
} satisfies ExportedHandler<Env>;
