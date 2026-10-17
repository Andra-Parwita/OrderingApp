# 082 · Store mode: a simple online store (up to 100 products, 20 categories)

**Status:** on the roadmap, later (owner, 17 Oct: "the store is in roadmap plan, we fix and will deploy the kitchen first"). Draft analysis (Fable agent, read-only); questions 2–9 resume when the owner picks it up. Not approved for building.
**Owner, 17 Oct:** "analyse to adapt this in admin for a seller to sell or make it like a simple online store (Amazon-like) with up to 50–100 items with up to 20 categories only, so My orders etc. should be the same but the product list display could be different." **Payments:** "still same until later in roadmap when we will support Square payments" (no online payments; Paid tick + optional deposit).

## Owner rulings
- **Mode is set once** when the admin creates the kitchen or store (owner "A", 17 Oct: "it sets one time, a person can have multiple store and kitchens").
- **One person, many places, one passkey** (owner, 17 Oct: "a person can be a store owner and a kitchen chef ... so can share passkey, i.e. keep one passkey"): the same person can own a store and be a chef in a kitchen (or own several of each), signing in with one passkey and switching between them, as plan 068 / D-088 already do for kitchens.
- **Payments:** none until Square (above).
- **Small photos only, few stores** (owner, 17 Oct: "for store we don't really need big photo, and not many will have a store"): one product picture of about 300 × 300 (~30 KB); 100 products ≈ 3 MB per store; a handful of stores ≈ under 10 MB in R2.

## What it means
A per-kitchen **mode** set by the admin: `menu` (today) or `store`. A store kitchen has an always-open catalogue (products in up to 20 categories) instead of a dated menu. Everything from the basket on stays the same: checkout, pickup/delivery, encrypted address (D-099), order code and `/o/<token>`, My orders, statuses, push, live updates, seller Orders / Kitchen / Pickup & delivery / labels / income, privacy rules.
Differs: catalogue with category chips, search and a grid on tablet; product sheet; stock counter per product; no cooking day, cut-off, publish wizard or auto-finish; orders archived per month instead of per menu; checkout shows the seller's lead-time note ("Ready in 2–3 days") and the pickup place hours.

## Recommended data model (option C)
Reuse dishes as products (one editor, one picture pipeline, one order path), add-only migration 0028: `sellers.mode`, `menus.kind` ('menu' | 'store', one permanent store menu), `categories (seller_id, id, name_en, name_id, position)`, `dishes/menu_items.category_id` and `.stock` (NULL = untracked). Guards: `ordering()` skips the cut-off for a store menu, `finishDueMenus` only finishes `kind='menu'`, `POST menus` refused on a store kitchen; the order write's portion guard also decrements stock; an hourly job archives finished store orders into a monthly "past" row; address wipe one day after delivered/collected. Limits: `MAX_STORE_ITEMS = 100`, `MAX_CATEGORIES = 20`. Rejected: A (no categories, finish/stock logic breaks), B (a second catalogue duplicating dishes, pictures, CSV, picker).

## Open questions (Fable's recommendation in bold)
1. ~~Mode~~ decided: A, fixed at creation (above).
2. Stock: A none / **B counter per product, sold out at 0, seller restocks** / C counter + reserve on basket.
3. Open hours: A always open / **B the "Taking orders" switch, as today** / C timed windows.
4. Fulfilment date: A none / **B seller's lead-time note + pickup place hours** / C customer picks a date.
5. Delivery fee: **A none now (fees come with Square)** / B flat fee / C postage.
6. ~~Payments~~ decided: none until Square (owner, 17 Oct).
7. Both modes in one kitchen: **A no; a second kitchen (plan 068 handles two on one phone)** / B yes.
8. Variants (size/flavour): **A one product per variant** / B option groups.

## Stages (sketch)
| # | stage | size |
|---|---|---|
| 0 | rulings, decision D-105, mock-up (customer store page, seller catalogue, admin switch) | S |
| 1 | data + repo: migration 0028, limits, guards, stock in the order write, monthly archive, tests | M (riskiest) |
| 2 | contracts + routes: `Seller.mode`, categories CRUD, dish stock/category, admin mode switch | S–M |
| 3 | admin UI: mode on create + switch | S |
| 4 | seller catalogue UI: categories, editor fields, "Products" nav, wizard hidden | M |
| 5 | customer store UI: store home, chips, search, grid, product sheet, copy | M–L |
| 6 | Help EN/ID, docs, e2e `p082-store`, a demo store kitchen | M |

**Risks:** code that assumes one finishing menu (past weeks, past-menu pictures, chef summaries, backup restore); stock vs portion limit; menu/dish wording in customer strings; WhatsApp post length with 100 items; store orders list query budget.
**Deploy impact (expected):** one add-only migration; existing kitchens unchanged; invisible until the admin switches a kitchen.
**Not to build:** payments, variants, shipping rates, customer accounts, coupons, reviews, galleries, category pictures, timed open windows, a second catalogue table.

## Second pass (same agent, after the payments ruling)
- Same recommendation (option C, admin-set mode, reuse dishes), with two refinements: a store reads products **from `dishes` directly** (adds `dishes.active`; no `menu_items` copies, which drift for a catalogue), and **stock is decremented at order time** (restored on cancel/edit) instead of "limit minus used". Store orders stay `kind='menu'` on a store menu that never finishes, so `LIVE_MENU` queries stay unchanged; only `finishDueMenus` skips store menus. Store orders expire by their own date.
- Seller side: nav "Catalogue"; hidden in store mode: menu wizard, publish, cook-day settings, Past menus (→ past orders by month), Cook tab and day selling ("Sell"); Pack and Pickup & delivery kept.
- Extra question: **post / shipping** as a third fulfilment: **A not now** / B later. Fulfilment date: the second pass recommends **A none in stage 1** (customer asks on WhatsApp), a seller "ready by" per order later.
- Stages trimmed to 5: data + repo (M), routes (S), customer catalogue (M), seller catalogue + admin switch (M), Help + docs + D-105 (S).
