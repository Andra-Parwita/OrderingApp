# 026 · A small error log the app sends to the server (last 500 only)

**Status:** approved by the builder (2026-10-10: "I think we need to have simple logging to send to server, in a loop, i.e. only allow max 500 logs or so"). Prompted by the iPad bug in plan 025, where the screen only said "Something went wrong".
**Goal:** when something goes wrong on a seller's or customer's device, a short entry reaches the server, so the admin can see what happened. It keeps only the newest 500 entries and never personal data.

## What an entry holds (and nothing else)
time · app (seller / customer / admin) · app version (plan 020) · kitchen slug if known · page path with tokens removed (`/o/<token>` becomes `/o/*`; query strings dropped) · kind (`api_error`, `js_error`, `unhandled_rejection`, `passkey_error`) · error code or name · a short message (at most 300 characters, with emails, phone-like digit runs and anything after `token=` scrubbed) · browser family and OS (from the user agent, e.g. "Safari iOS 17", not the full string) · whether it ran as a home-screen app. **No** names, notes, order codes, tokens, IPs or cookies.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Storage, a ring of 500.** Migration `0007_client_log.sql`: `client_log(id INTEGER PRIMARY KEY, at, app, version, slug, path, kind, code, message, agent, standalone)`. After each insert, delete everything but the newest 500 (one statement). | `migrations/`, `worker/db/` | tests: the 501st insert leaves 500 and drops the oldest |
| 2 | **Intake route** `POST /api/log`: a JSON body of at most 2 KB, up to 5 entries per call, validated and scrubbed on the server too (never trust the client), rate-limited per client (existing `rateLimit`, about 20 per 10 minutes per hashed IP, swept like plan 010's rows). Origin check as usual. Always answers 204, even when it drops entries. | `worker/api/`, `shared/` (contract and scrubber) | tests: oversize or invalid bodies are refused; the scrubber removes tokens, emails and digit runs; the rate limit holds |
| 3 | **Client sender.** One small `src/api/clientLog.ts`: hooks `window.onerror`, `unhandledrejection` and the API client's failed answers (status ≥ 500, and known codes like `invalid_request` on auth), plus the passkey errors in seller-auth. Batched, sent with `navigator.sendBeacon` or `fetch` with `keepalive`, with at most 20 entries per page load, and repeats of the same entry dropped. Off in tests. | `src/api/`, `src/main.tsx` (one call), `src/features/seller-auth/` (passkey catch) | tests: an API 500 makes one entry; repeats are dropped; tokens never leave the device |
| 4 | **Admin view.** Admin home gets a "Recent problems" list (newest first, 50 per page, filter by app and kitchen) with a "Clear" button. Admin session only. | `worker/api/authRoutes.ts` (admin part), `src/features/admin/` | tests: admin only (seller and anonymous get 401/403); the list shows entries |

## End of phase
- [ ] typecheck · lint · format · `mocks`, `shared`, admin and `src/api` unit tests · the D-007 privacy rule checked by the coordinator against a real entry · the plan 019 privacy note updated with one line ("When the app hits an error, a short technical note without personal details is sent so we can fix it")
