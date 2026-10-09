# Architecture overview

One Cloudflare Worker serves the React app and the API. State lives in D1 (data), R2 (images) and one Durable Object per seller (live events). Routes are listed in [api.md](api.md), tables in [data-model.md](data-model.md), sign-in in [seller-auth.md](seller-auth.md).

## Request path

```
browser ──► Worker fetch ──► checkOrigin ──► health, images ──► repository ──► routes ──┬─► D1
(React app) worker/index.ts  worker/auth/    worker/api/        worker/db/     worker/api/ ├─► R2 (IMAGES)
                             origin.ts       index.ts                          routes.ts   └─► Durable Object SellerLive
```

| step | what happens | where |
|---|---|---|
| 1 | Static files and the single-page app come from the Worker's assets; `/api` and `/images` run the Worker code | `wrangler.jsonc` |
| 2 | `checkOrigin`: a state-changing call to `/api/seller`, `/api/admin` or `/api/auth` must carry the site's own `Origin` (403 `bad_origin`), D-048 | [`worker/auth/origin.ts`](../../worker/auth/origin.ts) |
| 3 | `/api/health` is answered here; `/images/<key>` streams from R2 | [`worker/api/index.ts`](../../worker/api/index.ts) |
| 4 | The D1 repository is built from the bindings for this request; nothing is kept between requests | [`worker/db/`](../../worker/db/) |
| 5 | The router picks the area (public, token, auth, admin, seller, dev), resolves the session cookie, and calls one repository operation per action | [`worker/api/routes.ts`](../../worker/api/routes.ts) |
| 6 | Each operation reads in one batched round trip and writes in one atomic D1 batch. A portion-limit guard is the first statement of an order write, so two orders for the last portion cannot both win | [`worker/db/seller.ts`](../../worker/db/seller.ts) |
| 7 | After a successful write the route nudges the seller's Durable Object, which pushes "something changed" over the WebSocket; the screens refetch through the normal API. A missed nudge is covered by slow polling | [`worker/live/`](../../worker/live/), [`src/api/live.ts`](../../src/api/live.ts) |

Business rules live once, in the D1 repository ([D-047](../decisions/README.md)). Tests and the dev server run the same code on a local D1.

## The dev flag

`DEV_TOOLS=1` (set only in a local `.dev.vars`, never in `wrangler.jsonc` or as a Cloudflare variable) turns on every dev-only path: the `X-Seller` / `X-Actor` headers that stand in for a session, the `?seller=` fallback on the live socket, `/api/dev/*`, sample orders and reset, and the dev seller picker in the app. The app asks `/api/health` whether it is on. Production runs without it: those paths answer as if they did not exist, and the repository itself refuses `dev.reset`.

## Where data lives while developing

| what | where | owner |
|---|---|---|
| The owner's dev data (`pnpm dev`, port 5173) | `.wrangler/state` | the owner; agents never touch it |
| End-to-end tests | `scratch/e2e-d1`, made fresh by `scripts/scratch-server.mjs` (migrated and seeded, port 5181) | each Playwright run |
| Throwaway checks | `scratch/smoke-*` through the same script, on a port of its own | whoever started it |
| Unit and MSW tests | `scratch/d1-tests/<file>-d1`, one local D1 per test file through wrangler's `getPlatformProxy`, deleted afterwards | `mocks/impl.ts` |

The scratch script refuses any directory outside `scratch/` and port 5173. Never use `--remote` before phase 5.

## Weekly retention cron

`triggers.crons` in `wrangler.jsonc` runs `scheduled` in [`worker/index.ts`](../../worker/index.ts) every Monday at 03:00 UTC. It calls [`runRetention`](../../worker/api/scheduled.ts), which drops the order details of every seller's closed weeks that are more than 4 weeks past their cooking date ([D-044](../decisions/README.md), data-model [Retention](data-model.md#retention-d-027-row-6-d-044)). The totals stay, and each order leaves a token-and-date stub so its old link says "archived". It is idempotent (a second run finds nothing) and logs counts only, for example `retention: 2 week(s) archived, 14 order(s) dropped`. Opening history, a backup or an old order link runs the same step for that seller or order, so the cron guarantees it also happens for quiet kitchens.

To try it on a scratch server: `curl -k https://localhost:<port>/cdn-cgi/handler/scheduled`.

## What runs where in phase 5

| piece | now (phases 1 to 4) | phase 5 (the owner's deploy) |
|---|---|---|
| Worker, assets | `@cloudflare/vite-plugin` in the dev server (Miniflare), HTTPS with mkcert | `*.workers.dev` first, a custom domain later |
| D1 | local SQLite, `database_id: "local-only"` | a real database, migrations applied with wrangler |
| R2 (`IMAGES`) | simulated bucket | a real bucket `delave-images` |
| Durable Object `SellerLive` | local, SQLite-backed (`new_sqlite_classes`, free plan) | the same migration tag `v1` |
| Secrets | `.dev.vars` | `wrangler secret put ADMIN_SETUP_KEY`; `DEV_TOOLS` never set |
| Cron | triggered by hand | runs on the schedule once deployed |
| Passkeys | `https://localhost` and a virtual authenticator; phones use the password | a real domain makes passkeys work on phones |
| Limits to design for | none locally | free plan: 50 D1 queries per invocation (held under 40 by a test) |
| Still to add | - | Web Push, real QR codes (needs a dependency OK) |
