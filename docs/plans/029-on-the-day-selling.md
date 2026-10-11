# 029 · Selling on the day: stock, sales log, end-of-day summary

**Status:** approved by the builder (2026-10-10). From the owner's handover doc ("Ordering type per item", "On-the-day sales (v1)", "Build into v1"). Needs plan 028 first, so helpers can sell.
**Goal:** a dish can be pre-ordered (as now), sold on the day, or both, with the two counted apart ([D-083](../decisions/README.md)). On the day, owners and helpers record sales on several devices at once. Payment stays outside the app. Stock is correct on every device and on the customer menu, and the day ends with a summary to check against the cash.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **How a dish is sold.** Each menu item gets `preorder` (on by default; its existing portion limit stays the pre-order limit) and `day_stock` (empty = not sold on the day). Off + a stock = "on the day only"; on + a stock = both. Set in the dish editor; saved sets keep both. The customer menu shows on-the-day-only dishes as "Available on the day" with no Add button, and dishes sold both ways as usual plus "Also at the stall"; the server refuses an on-the-day-only dish in an order. Pre-orders never take from the day stock. | `migrations/`, `shared/menuContract.ts`, `worker/db/menus.ts`, `src/features/seller-menu/`, `src/features/customer-menu/`, i18n | tests: an on-the-day-only dish in an order is refused; a dish sold both ways takes pre-orders up to its limit while the day stock stays the same; saved sets keep both; the customer sees each label |
| 2 | **Atomic stock and the sales log.** New table `day_sales(id, seller_id, menu_id, item_id, change, stock_after, by_account, at, undone)`. A sale is one statement, `UPDATE … SET day_stock = day_stock - ? WHERE day_stock >= ?`, plus its log row, so two helpers can't both sell the last portion. "Set count" writes the new stock and logs the difference. At 0 the dish is sold out at the stall; pre-orders are unaffected. Owners and helpers only. | `migrations/`, `worker/db/`, `worker/api/routes.ts`, `shared/` (contract) | tests: two sales of the last portion at once give one success and one `sold_out`; set count logs the difference; a chef gets 403 |
| 3 | **Live everywhere.** Every sale or count is pushed through the `SellerLive` Durable Object to the seller devices, and the customer menu shows sold out (never the count) on its next refresh. | `worker/` (SellerLive), `src/api/live.ts`, `src/features/customer-menu/` | tests: a sale on one device shows on another (live test); the customer menu shows sold out at 0 |
| 4 | **Sell screen.** A phone-first "Sell" screen: on-the-day dishes with stock, a big "−1" (and "−n"), "Set count", and **Undo** for 5 seconds after each sale. Owners can correct a log entry later. | `src/features/seller-saturday/` (new SellScreen), `src/app/sellerNav.ts`, i18n | tests: sell, undo restores stock, set count; e2e one sell flow on the phone |
| 5 | **End-of-day summary.** Per dish: pre-ordered vs sold on the day; sales per person; the log. CSV download (the existing CSV helper). | `src/features/seller-history/` or `seller-saturday/`, `shared/csv.ts` | tests: totals match the log; the CSV has the same rows |

## End of phase

- [ ] typecheck · lint · format · `mocks` stock-race and route tests · `shared` · seller-menu, customer-menu, seller-saturday unit tests · e2e the sell flow and `customer-batch1` (`--workers=1`)
- [ ] The owner runs a pretend stall day on the demo kitchen with two devices

## Decisions and notes

- **Day stock is set at any time** (builder "A", 2026-10-10): an expected number when the menu is made, corrected on the day with "Set count"; every change is in the sales log.
- **Customers never see the count** (builder "A", 2026-10-10): only "Available on the day" or "Sold out".

- **Left out for now (in the doc under "Worth considering"):** offline selling with a queue, "switch person" on a shared stall tablet, per-kitchen usage limits, and Square. Each can be its own plan later.
- **The sales log is kept 10 weeks per kitchen** (builder "A", 2026-10-10), removed by the existing weekly clean-up (`worker/api/scheduled.ts`); the end-of-day CSV is the longer record.
