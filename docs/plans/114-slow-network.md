# 114 · Slow networks: timeouts, no double orders, clear feedback

**Target: hotfix 1.0.43.1** (owner, 20 Oct: "since it's just perf and not too visible").
**Status:** review by Fable (20 Oct, code reading only). Owner 20 Oct: items 1–5 in **1.0.44**, right after 1.0.43 ("A"); not built yet. Owner: for customers only "Place order" matters on a slow link; later also think about several customers racing for the last portions (today the server guard already lets only one win: `portionGuard`, `mocks/portionRace.test.ts`; idea: update the loser's basket instead of only an error).

## Works today
Last good data stays on screen with an offline strip + Try again; basket, checkout, New order, Pack ticks and Made counts survive a reload; live updates reconnect with back-off and reload on wake; Confirm/Paid roll back with Retry; Place order / New order / Edit order can't be double-tapped.

## Fix soon (ranked)
1. **No request timeout** (`src/api/http.ts:57`): add `AbortSignal.timeout` (10 s reads; 45 s writes, owner 21 Oct "A", first built as 20 s), mapped to the existing "network" failure path.
2. **Double order when the answer is lost** (`customer-menu/saga.ts:91-104`, `worker/api/customerOrder.ts`): a `clientOrderId` kept in the basket draft; the server returns the existing order on a repeat.
3. **Sell −1 double tap** (`seller-saturday/SellScreen.tsx:280-293`): disable while the sale is in flight.
4. **Taking orders / Sold out fail silently** (`seller-orders/sellerOrdersSaga.ts:471-491`): show an error, roll back, disable while saving.
5. **Service worker waits on a slow (not dead) link** (`public/sw.js:51-62`): fall back to the cache after ~4–5 s; consider precaching the build's files.

## Later
- Live link gives up after ~90 s of failures (`src/api/live.ts:69,122-129`): keep retrying at 30 s.
- Undo can overtake a slow Confirm (`sellerOrdersSaga.ts:557`).
- Made counts and Send update can repeat on a lost answer (same idempotency idea as 2).
- Live Edit-menu session isn't kept across a reload (`draftSession.ts:33-35`).
