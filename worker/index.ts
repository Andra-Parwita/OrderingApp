import { handleWorkerRequest, type ApiEnv } from './api';
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
};

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> =>
    handleWorkerRequest(request, env, ctx),
  // The crons in wrangler.jsonc. Every run finishes the menus whose cooking day has ended (hourly);
  // the Monday 03:00 UTC run also does retention for every seller.
  scheduled: async (controller: ScheduledController, env: Env): Promise<void> => {
    const now = new Date();
    await runAutoFinish(env, now);
    await runAttemptSweep(env, now);
    if (controller.cron === RETENTION_CRON) await runRetention(env, now);
  },
} satisfies ExportedHandler<Env>;
