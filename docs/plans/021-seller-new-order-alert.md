# 021 · Seller: notice new orders while the app is open

**Status:** approved by the builder (2026-10-10, "A": toast, highlight, optional sound, tab title; seller push when the app is closed is a later, separate plan). Starts after plan 018, which edits the same Orders files.
**Today:** new orders reach the open seller app through the live connection (`SellerLive`, event `order.created`) and the list refreshes silently.
**Goal:** the seller notices each new order without watching the list.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Spot new orders.** When the orders list reloads (live event or poll), the orders whose ids weren't there before, and which were placed by a customer (not the seller's own New order, and not dev or demo samples), count as new. Skip the first load. | `src/features/seller-orders/` (saga, selectors) | tests: first load → none; a reload with one more → that one; own or sample orders → none |
| 2 | **Toast and highlight.** One new: "New order · Tom · V34-P42" with **Open** (selects it). Several: "3 new orders" with **Show**. The new rows get a soft background highlight that fades after about 6 s (no animation under reduced motion). The Orders nav item shows a small dot until the list has been viewed. EN/ID. | the same, and `src/app/sellerNav` if the dot needs it | tests: the toast text in both languages; Open selects the order |
| 3 | **Optional chime and tab title.** Settings → Preferences: "Sound for new orders" (off by default, per device, in localStorage). It plays a short, quiet Web Audio tone (no audio file); the audio is unlocked on the first tap, as iOS requires. When the page is hidden, the document title shows "(2) Orders · <kitchen>" until it is visible again. | `src/features/seller-settings/` (PreferencePanes), the seller-orders saga, a tiny `src/components/chime.ts` | tests: the switch is remembered; no sound when off; the title count resets when visible |

## End of phase
- [ ] typecheck · lint · format · seller-orders and seller-settings unit tests · e2e `seller-list-scroll` (`--workers=1`)
