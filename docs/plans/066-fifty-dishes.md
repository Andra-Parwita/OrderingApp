# 066 · Up to 50 dishes on a menu, with labels and print split properly

**Status:** approved (2026-10-12, owner: "we want more order dishes, but also make sure we print labels properly and split them accordingly"; "since we can have multiple chefs … up to 50 dishes per menu"; portions per dish stay **99** ("or keep it as 99"; a customer who needs more can simply order twice)).
**Goal:** `MAX_MENU_ITEMS` 10 → **50** (`MAX_QTY` stays 99). Everything that lists a menu's dishes or an order's lines still works and stays fast and readable with 50: the server (an order can have up to 50 lines), labels (split per chef and per dish, as many sheets as needed), A4 print (no row cut across pages), the WhatsApp post (its 500-character limit), the customer menu (lazy pictures, quick on a phone) and the seller's menu screens.

## Rules
- **Server limits:** Cloudflare's free plan allows about 50 database calls per request. Placing, editing and finishing stay well inside it with a 50-line order and a 50-dish menu: statements go in one `db.batch`, never one call per line. A test counts the calls.
- **Labels:** grouped by chef, then dish, as today; more sheets when needed, nothing dropped; long dish names wrap or end with "…" inside the label.
- **Print (A4):** rows never split across pages; per-chef totals and the cook list paginate; totals stay correct.
- **WhatsApp post:** lists dishes until the text limit, then "+ N more on the menu" with the link (EN + ID), never a cut-off line.
- **Customer menu:** pictures `loading="lazy"` and sized; 50 rows scroll smoothly; the basket handles 50 lines.
- **Seller:** the Dishes step and the Check table stay usable with 50 (reuse any search/filter that exists; no new design unless needed).

## Stages
| # | stage | files | done when |
|---|---|---|---|
| 1 | limit 50; server within the call budget; backup accepts 50 | `shared/limits.ts`, `shared/menuContract.ts`, `shared/backup.ts`, `worker/db/seller.ts`, `worker/db/menus.ts` | mocks: a 50-dish menu publishes; a 50-line order places and edits; call count ≤ 40 |
| 2 | labels + print + WhatsApp post with 50 | `src/components/labels/`, `src/features/seller-orders/print*`, the post builder | unit: 50 dishes × several chefs → every label, chef-grouped; print rows unsplit; post ends "+ N more" |
| 3 | customer menu + seller screens with 50 (after plan 061) | `src/features/customer-menu/`, `src/features/seller-menu/` | unit + e2e `customer-batch1`, `seller-menu`; a phone capture of a 50-dish menu |

## End of phase
- [ ] typecheck · eslint · unit · e2e `customer-batch1`, `seller-menu`, `print-orders`
- **Deploy impact:** none to apply (no migration). An old app version (until people refresh) refuses a menu with more than 10 dishes: publish 11+ dishes only after the new-version bar (plan 059) has had a day to reach everyone.
