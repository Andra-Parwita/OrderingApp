# 010 · Order lookup: review fixes before Cloudflare

**Status:** approved by the builder (2026-10-10, "A"), from the pre-Cloudflare review of plans 008 and 009.
**Goal:** "find my order" (D-075) doesn't lock out strangers who share an IP, keeps no wrong-try data longer than needed, and never says "not found" without asking the server.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Per-code 2, per-IP 10.** The per-kitchen-and-code scope keeps 2 tries; the per-IP scope allows 10 (one `ORDER_LOOKUP_MAX_FAILS_PER_CLIENT = 10` next to `ORDER_LOOKUP_MAX_FAILS`). `guessLimited` takes a limit per scope. Both scopes lock for 15 minutes. | `shared/authContract.ts`, `worker/db/auth.ts`, `worker/repo/Repository.ts`, `worker/api/routes.ts` | tests: 2 wrong tries on one code lock that code; 3 wrong tries spread over 3 codes from one IP don't lock; the 10th wrong try from one IP locks it |
| 2 | **Sweep wrong-try rows.** The hourly cron deletes `auth_attempts` rows whose `updated_at` is older than the lock time and whose lock has ended (or that never locked). Correct the comment in `routes.ts` so it states what is actually kept. That limits how long an IP hash is kept, which answers finding 3; no new secret. | `worker/api/scheduled.ts` (or the retention module it calls), `worker/db/` | a test: rows older than 15 minutes with no live lock are gone after the cron; a live lock stays |
| 3 | **No false "not found".** If the phone has no saved kitchen, My orders says "Open your kitchen's link first, then try again" instead of asking the server. When it can ask, the find form says which kitchen it searches ("Searching in Onde Onde"). EN and ID. | `src/features/customer-orders/MyOrdersScreen.tsx`, `MyOrdersView.tsx`, its i18n and test | tests: no saved kitchen shows the hint and makes no request; a saved kitchen shows its name |
| 4 | **Dev samples: a failed request shows a message.** `devSampleOrders` shows an error toast ("Couldn't add samples") when the request fails. EN and ID. | `src/features/seller-orders/sellerOrdersSaga.ts`, slice toast kinds, i18n, saga test | a test: a failed request shows the error toast |

## End of phase
- [x] typecheck · lint · format:check · unit tests for `mocks`, `shared`, customer-orders and seller-orders

## Result (09:58)
- The coordinator re-ran typecheck, lint, format:check and 888 unit tests (mocks, shared, customer-orders, seller-orders, harness, app).
- The sweep touches only find: rows; sign-in counts (D-027) are unchanged.
- Open, low: in worker/index.ts the sweep runs before weekly retention without its own try/catch, so a failed sweep would skip that week's retention; the comment at scheduled.ts:18 still says the hourly run only finishes menus.
- Process slip: one bash heredoc, used to append to retention.ts (content checked).
