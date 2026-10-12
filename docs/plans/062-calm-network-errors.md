# 062 · Calm network and refusal handling

**Status:** approved (2026-10-12, owner "A"; both questions answered). Builds after 061 (shared files).
**Goal:** a refused or failed request is never repeated without end. One shared retry rule, a calm "offline / try again" state on screen, and polling and the live connection that slow down or stop when the server says no.

## Today (survey)

- **One fetch place:** `request()` / `requestText()` in `src/api/http.ts`. It never retries. Network error → `{error:'network', status:0}`; any non-2xx → parsed `ApiFailure` (`shared/apiError.ts`); `unauthorized` only clears the session hint (`setSessionHint(false)`). No 429/Retry-After handling.
- **Seller polling:** `liveRefreshLoop` (`src/api/live.ts:298-325`) is `while (true)`: loads on each live event, on each reconnect, and every `fallbackMs` (60 s, `sellerOrdersSaga.ts:95`, `cookSaga.ts:15`) while the socket is down. It ignores the result of `load`, so a 401/403/5xx is re-asked every minute until the screen stops or `staffSignedOut` fires.
- **Live socket:** `connectLive` (`live.ts:56-140`) reconnects with backoff 1 s → 30 s (jitter), **no cap on attempts**, and cannot tell a refused upgrade (401/403) from a dropped network. The dot goes `offline` after 3 failures (`live.ts:169-190`) but keeps trying every ~30 s.
- **Customer order page:** `OrderScreen.tsx:48` `setInterval` every 15 s (`POLL_MS`), also while the tab is hidden; failures other than `network` are ignored silently (`customer-orders/sagas` `refreshOrder`), so a refusal repeats every 15 s forever.
- **Admin RefreshBar:** manual button with a 60 s cooldown; its interval only drives the clock. Fine.
- **UpdateBar check** (`src/components/update/updateCheck.ts`): at most once per 5 min on return to front, failure → silent. Fine.
- **Push:** `src/api/push.ts` single calls, no loops. Fine.
- **Service worker** (`public/sw.js`): network-first with cache fallback for shell, menu and order data; no retry loop. `cacheFirst` throws when offline and uncached (assets only).
- **Screens:** customer screens show `OfflineNote` / retry button (`customer-orders/layout.tsx`, `customer-menu/layout.tsx`); seller screens each have their own "Retry" button; `LiveDot` shows live / reconnecting / offline. There is no single offline banner and no distinct "not allowed" message.

## Rules
- **One retry policy** in `src/api/`, used by `request()`: up to **3 retries** at about **1 s / 3 s / 9 s**, each with up to 25 % jitter, **only** for a network error, a 5xx, or a 429 (honouring `Retry-After`, capped at 30 s).
- **Only safe calls retry.** GET always. A POST/PATCH/DELETE retries only on a network error before any response and only if it is idempotent (or carries an idempotency key); otherwise it fails once and shows Try again. (Open point: see questions.)
- **401** → the signed-out flow once (`staffSignedOut`, session hint off), then every poll and the socket stop. No retry. **403** → a clear "You're not allowed to do this" message, stop. **Other 4xx** → show the message, stop. **404 on an order** → the existing expired state.
- **Polls** (seller orders/cook, customer order page) double their gap after each failure up to a max (5 min), reset on success, **stop after 5 refusals in a row** (401/403/4xx) and show the calm state with Try again; a manual Try again restarts them. Customer polling pauses while the tab is hidden and refreshes once on return.
- **Live socket:** keep backoff but cap at **8 attempts**, then stop and rely on the slow poll; if the page learns the session is gone (a 401 from any call, or `staffSignedOut`) it closes the socket and does not reconnect. Coming back online (`online` event) or the tab becoming visible restarts it once.
- **One calm banner** (`OfflineBanner`, EN + ID) driven by `navigator.onLine` plus recent failures: "You're offline. Your changes are kept. We'll try again when you're back." / "Server isn't answering. Try again in a moment." Muted, role=status, with a Try again button; it hides itself when a call succeeds. Per-screen retry buttons stay.
- **Never lose what was typed:** a failed save keeps the form, basket and drafts exactly as they are (follows plan 061); retries never re-submit an order without the person tapping.
- All strings EN + ID through i18n; WCAG AA; no tech words (no "5xx", "timeout").

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Shared policy** `retryPolicy` (delays, jitter, what is retryable, Retry-After) and use it in `request`/`requestText`; add `status`-based `refused` helper (401/403/4xx). | `src/api/retryPolicy.ts` (new), `src/api/http.ts`, tests | unit with fake timers: 503 retried 3× then fails; 401/403/400 not retried; 429 honours Retry-After; POST not retried after a response |
| 2 | **Polls stop and slow down:** `liveRefreshLoop` reads the result of `load`, backs off, stops after repeated refusals and reports "stopped"; 401 → `staffSignedOut`. Sagas pass the result back. | `src/api/live.ts`, `seller-orders/sellerOrdersSaga.ts`, `seller-cook/cookSaga.ts`, slices (a `pollStopped` flag) | unit: 5 refusals stop the loop; success resets the gap; sign-out ends it |
| 3 | **Live connection:** attempt cap, no reconnect after sign-out/refusal, restart on `online`/visible. | `src/api/live.ts`, `live.test.ts` | unit: stops after the cap; restarts on `online`; `LiveDot` shows offline |
| 4 | **Offline banner** component + hook (`useNetworkState`), mounted once in the seller shell and once in the customer shell; 403 "not allowed" text in the shared error mapping. | `src/components/network/` (new), `src/app/` shells, i18n EN/ID, `src/features/admin/shared.tsx`, `seller-auth/authText.ts` | unit: banner shows offline, hides on success, EN + ID; axe-clean |
| 5 | **Customer pages:** order page poll uses backoff, pauses when hidden, stops on refusal; menu/basket/My orders show the same calm state; typed data untouched. | `customer-orders/OrderScreen.tsx`, `customer-orders/` saga, `customer-menu/` | unit: hidden tab no polls; refusal stops polling; basket kept after failure; e2e `customer-batch1` |

## End of phase
- [ ] typecheck · eslint · prettier · the touched unit tests · e2e `customer-batch1` and the seller orders spec (simulate offline with Playwright `context.setOffline`)
- **Deploy impact:** none expected (client only; no migration, no API change). Risk to watch: a too-short give-up could leave a seller screen stale; the banner and Try again must always offer a way back. The service worker file is unchanged.

## Questions for the owner
1. **Decided (owner "A", 2026-10-12): a failed save is never retried automatically;** the screen says "Didn't go through · Try again" (no double orders).
2. **Decided (owner "A", 2026-10-12): stop after 5 refusals in a row** and show "Can't reach the kitchen right now · Try again"; no quiet background checking after that.
