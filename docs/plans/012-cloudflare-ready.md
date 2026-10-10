# 012 · Ready for a real test on Cloudflare (order.shaggybobo.app)

**Status:** proposed (2026-10-10, builder: "get ready to deploy to cloudflare for real test"). **Approved** (10:06, D-076). Stage 1 waits for plan 011, which also edits `wrangler.jsonc`.
**Goal:** everything on our side is ready, so the deploy itself is a short list of commands the owner (or the builder with the owner's OK) runs: one Cloudflare account, the `order.shaggybobo.app` address, a real database, image storage and secrets. Nothing here connects to Cloudflare; the deploy steps stay the owner's.

## Stages

| # | stage | who | done when |
|---|---|---|---|
| 1 | **Names without "Delave"** (D-052). `wrangler.jsonc` still says `database_name: "delave"` and `bucket_name: "delave-images"`. Before they are created on Cloudflare, rename them to `shaggybobo-order` and `shaggybobo-images` (renaming later means a new database). The app runs at **`https://order.shaggybobo.app`** (D-077): `"routes": [{ "pattern": "order.shaggybobo.app", "custom_domain": true }]` and `"workers_dev": false`, since passkeys are tied to one address. The Worker name stays `ordering-app` (not visible to anyone). Check that local dev and tests are unaffected by the renames. | builder agent | the config is renamed; local dev and tests still pass |
| 2 | **Build and dry run.** Add `"deploy": "pnpm build && wrangler deploy"` to package.json (the owner runs it). The coordinator runs `pnpm build` and `wrangler deploy --dry-run` (no upload, no login) to prove the bundle, bindings, Durable Object migration and crons are valid. | coordinator | both succeed; bundle size noted |
| 3 | **Gate before deploy** (builder, 10:16: the full Playwright suite takes too long): typecheck, lint, format, **all** unit tests, and Playwright only for what changed since plan 004's full run (`kitchen-links`, `seller-list-scroll`, the customer specs, admin, seller-saturday) on `mobile-chromium` and `desktop-chromium`. | coordinator | green |
| 4 | **Runbook** `docs/guide/deploy-cloudflare.md`: the owner's steps in order, as follows. 1. `wrangler login`. 2. Create D1, and paste its id into `wrangler.jsonc`. 3. Create R2. 4. Apply migrations to the real DB. 5. Secrets: `ADMIN_SETUP_KEY` (new and strong, not the dev one), `VAPID_*` from `scripts/vapid-keys.mjs`, `VAPID_SUBJECT` as a `mailto:`. **Never `DEV_TOOLS`.** 6. `pnpm run deploy`. 7. First visit: admin setup with the key, then create the first seller and send its invite. 8. Phone tests: iPhone (Add to Home Screen, then push), Android, the seller tablet. 9. How to roll back (`wrangler rollback`) and watch logs (`wrangler tail`). | coordinator | the runbook is reviewed by the builder |

## Not in this plan
- Moving local data to Cloudflare. The real DB starts empty, and sellers are created through admin.

## End of phase
- [ ] stages 1–4 done; the owner has what they need to deploy
