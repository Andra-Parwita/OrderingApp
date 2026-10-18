# 099 · A bigger store (grocery-size): what changes, where today's model breaks, one deployment or many

**Status:** analysis for the owner (Fable, 18 Oct, read-only). **Owner, 18 Oct: "we don't have to implement yet what Fable recommends; for now it is analysis, maybe for v1.1.0 where it may include the small Sandra store functionality."** Nothing here is approved for building; v1.1.0 is plan 082's small store (mock-up "Sandra's Store"); everything "bigger" is later and only when a real store asks.
**Owner, 18 Oct:** "Also analyse if we have a bigger store or grocery store (which of course we can deploy to a different Cloudflare or server for this store), such as [an Indonesian/Asian grocery shop on Goodwood Road, Adelaide]." The shop is used only as a size-and-shape example: no branding, no claims about any real business.

## 1. What changes against plan 082's simple store (≤ 100 products, ≤ 20 categories)

| area | 082 small store | grocery-size shop | what it needs that we do not have |
|---|---|---|---|
| catalogue | 100 products, 20 flat categories | 1,000–5,000 products, a category tree (aisle → shelf), brands | `categories.parent_id`, product search (name EN/ID, brand, barcode), paging |
| product | one dish-like row, one 300 px picture | variants (size / weight / flavour), barcode / SKU, unit price per kg, price changes weekly, "out of stock" from the POS | `products` fields: `sku`, `barcode`, `unit`, `pack_size`; a variant model (082 Q8 said one product per variant: still the cheapest) |
| stock | counter per product, seller restocks (082 Q2 B) | counts come from a POS; reserve on basket; "substitutions allowed" | POS import of stock, a reservation rule, substitution flag per line |
| import | CSV ≤ 500 rows (`IMPORT_MAX_ROWS`, dish columns) | nightly CSV / POS export of 5,000 rows with price and stock | a `products` CSV with sku / barcode / category / price / stock; upsert by sku; chunked (500 rows per request) |
| pictures | few, ~30 KB | 5,000 × 30 KB ≈ 150 MB in R2 per shop; many without a picture | fine for R2 (10 GB free); upload tooling by sku, placeholder per category |
| basket | 10–20 lines | 30–60 lines; weights ("0.8 kg"); per-line note | `MAX_MENU_ITEMS = 50` caps order lines today; decimal quantities (today `qty` is an integer ≥ 1) |
| fulfilment | pickup / delivery, one address | delivery zones and fees by suburb, delivery slots, click-and-collect windows | `delivery_zones (postcode → fee_cents)`, a fee line on the order, slot capacity |
| hours | "Taking orders" switch | opening hours, cut-off per delivery day | hours table or a rules row |
| team | owner / chef / helper | owner, pickers, packers, drivers, a cashier at the counter | roles stay three; "picker" = helper; a per-order assignee is new |
| volume | 10–50 orders a week | 100s a week, 20–50 a day | paging in the Orders list, archive by day, search by code / name |
| money | Paid tick, deposit | **payments become necessary** (Square), GST on receipts, refunds and partial refunds (out-of-stock lines) | `order_payments`, a GST flag per product, a receipt (tax invoice) PDF or page, refund flow |
| legal | none | tax invoice with ABN, GST breakdown, returns policy | a settings page, a receipt template (bilingual) |

Short version: the small store is "a menu that never finishes". A grocery shop is a different product: catalogue management, POS integration, money and tax. Each row above is a plan of its own.

## 2. Where today's model and limits break (figures as of 18 Oct; verify on the Cloudflare pricing page before deciding)

| limit | today | where it bites | fix (no renames) |
|---|---|---|---|
| **D1 rows read, Free plan: 5 M/day** | the customer menu reads every item of the menu (≤ 50) | 5,000 products × 1,000 visits/day = 5 M rows read. The catalogue must be **paged per category** and cached at the edge (the public menu answer is already cacheable; today `GET /api/s/:slug/menu` is read on every open) | page by `(seller_id, category_id, position)` with an index; cache the public catalogue 60 s; search by a prefix index on `name_en` / `name_id` / `barcode` |
| **D1 rows written, Free: 100 k/day** | small | a nightly 5,000-row import plus orders is fine; a per-minute POS sync is not | import by diff (changed rows only), once a day |
| **D1 database size: 500 MB Free / 10 GB Paid** | tiny | 5,000 products ≈ 5 MB; 100 orders/day × 40 lines × 52 weeks ≈ 2 M `order_lines` rows/year ≈ 300 MB | the 4-week detail retention already deletes lines; keep it; totals per month, not per order |
| **D1 queries per invocation: ~50** (budget in `mocks/queries.test.ts`, every route under 40 with 100 orders) | fine | a 60-line order write re-checks limits per line inside the batch; a store order of 60 lines with stock decrements must stay in one `batch` with ≤ 50 statements | one statement per line is the ceiling: 50 lines, or a two-step write |
| **Worker CPU: 10 ms Free / 30 s Paid** | fine | `exportBackup` builds the kitchen's whole JSON in one request (products + orders): 5,000 products is over 10 ms; CSV parse of 5,000 rows is marginal | chunked backup (per table, per page); chunked import (500 rows, as today) |
| **Workers requests: 100 k/day Free** | fine | 1,000 customer visits × (menu + images + status + notes) ≈ 10 k; fine until ~10 k visits/day | Paid plan ($5/month) long before this matters |
| **`listOrders` reads every live order** (`worker/db/seller.ts:1606`: `readOrders(... LIVE_MENU).reverse()`) and the Orders screen renders them all | 10–50 rows | 300 live orders with lines, audit and inbox = the query budget and a slow tablet list | `LIMIT` + a cursor on `(seller_id, past_week_id, created_at)` (index `orders_by_week` exists); archive delivered orders daily, not when "the menu finishes" (082's monthly archive) |
| **Live updates**: one Durable Object room per seller, "something changed" nudges, each nudge → every open tablet re-reads the list | 2–3 devices | 10 staff devices × 300 orders × every change = thousands of list reads/hour | nudge with the order code (customers already get `order.changed` with a code); the seller list patches one row |
| **Phone rendering**: `MenuHomeView` lists every item; no virtualisation | 50 items | 5,000 products | category pages + search; render ≤ 100 rows per page |
| **Push**: 50 subrequests per request (Free) | fine | 300 "ready" pushes in one bulk update exceed it | `sendUpdates` already batches up to 200 codes; batch pushes via the cron or a queue |
| **Order lines `qty INTEGER ≥ 1`**, `MAX_QTY = 99` | fine | weights (0.8 kg) | `qty_milli` or a `unit` + integer grams: a new column, no rename |
| **Backups** (`shared/backup.ts`: one JSON of everything) | small | >10 MB files in the browser | per-table export; or the D1 export in `backups/` (already how the owner keeps real data) |
| **Images** (`MAX_DISH_PICTURES = 300`, R2 10 GB Free, Class A 1 M/month) | fine | 5,000 pictures ≈ 150 MB: fine; the **upload** path is one at a time through the browser | a bulk upload by sku (a script, not a screen) |

Indexes a bigger store needs (add-only): `products (seller_id, category_id, position)`, `products (seller_id, barcode)`, `products (seller_id, name_en)` exists for dishes, `orders (seller_id, status, created_at)` for the day list, `order_lines (seller_id, item_id)` exists. New columns only, no renames: `dishes` / `menu_items` stay the product tables (082 option C), plus `sku`, `barcode`, `unit`, `gst`, `category_id`, `stock`.

## 3. One deployment for all, or one per big store

**What assumes one deployment today** (all per Worker, `wrangler.jsonc` + secrets): the account and route (`order.shaggybobo.app`, D-077; the host name is spelled out in 8 source files, 23 places: `shared/kitchenHeadLinks.ts`, `seller-about/aboutTokens.ts`, `seller-help/topics.ts`, tests); one D1 (`shaggybobo-order`), one R2 bucket (`shaggybobo-images`), one Durable Object namespace, the two crons; secrets `ADMIN_SETUP_KEY`, `VAPID_*` (push keys: a subscription is bound to the key pair), `ADDRESS_KEY` (address encryption: a backup from one deployment is unreadable in another), `MAINTENANCE_TOKEN`, `MAPS_EMBED_KEY`; one `admin` account (`accounts.id = 'admin'`) and one `app_settings` row (maintenance, notice); `APP_NAME` ("ShaggyBobo's Order", `shared/appName.ts`); the service worker and manifests per kitchen slug; the release process (`pnpm run deploy` = build + `wrangler deploy` to that one account).

| | **A · multi-tenant, one deployment** (today, D-036) | **B · one deployment per big store** (same code, own account / Worker / D1 / R2) |
|---|---|---|
| isolation | shared database and Worker: one store's 5,000 products and 300 orders/day share the Free-plan daily quotas with every kitchen | each store has its own quotas, limits, outages and bills; a kitchen is never slowed by the shop |
| cost | one Free plan until the quotas (§2) are hit, then one Paid plan ($5/month) for everyone | the shop pays its own Paid plan (~$5/month + usage); the kitchens stay free |
| updates | one deploy, everyone on the same version | a deploy per deployment; versions can drift; a migration must run in each |
| backups and data | one D1 export; the shop's data sits beside the kitchens' | per store; the store owner can hold their own export; a leak in one cannot reach the other |
| domains | one host; stores are paths (`/slug`) | the shop's own domain (`shop.example.au`); the customer PWA installs under that name |
| admin | one admin sees every seller | one admin per deployment (fine: the store is its own business) |
| push, addresses | one key pair, one address key | per deployment; subscriptions and sealed data never cross |
| code | nothing to change | **config per deployment**: a `wrangler.<name>.jsonc` (or `env.<name>`), the host name out of the 8 files into one config value, `APP_NAME` per deployment, a release step that migrates and deploys each |

**Recommendation:** stay multi-tenant for every kitchen and for the small store (082); when a grocery-size shop is real, give it **its own deployment (B)**, because its quotas, money and tax are not the kitchens' business. "One codebase, many deployments" needs only: (1) `wrangler` environments (`[env.shop]` with its own D1 / R2 / DO / route / vars), (2) host name and app name read from config, not spelled out, (3) a release checklist that lists the deployments and runs `migrate` + `deploy` for each, (4) a per-deployment `admin` setup key. About two days of work when needed, none now.

## 4. A staged path

| stage | what | when |
|---|---|---|
| 1 | **Plan 082 small store** (≤ 100 products, 20 categories, stock counter, no payments), mock-up "Sandra's Store" | v1.1.0 |
| 2 | **Bigger-store basics**, only when a real shop asks: category pages + search, paged catalogue, sku / barcode columns, products CSV upsert by sku (chunked), order list paging and daily archive, decimal quantities, delivery fee by suburb | after a store is live and asks |
| 3 | **Money and tax**: Square (after its ruling), GST flag, tax invoice page, refunds | with the Square plan |
| 4 | **Split the deployment** (§3 B) when a shop reaches hundreds of orders a week or wants its own domain, name and bill | at that shop's go-live |

**Do not build until a real store asks:** variants / option groups, POS integration, delivery slots, substitutions, picker assignment, customer accounts beyond Remember me, coupons, reviews, a second catalogue table, any rename.

## 5. Questions for the owner (A / B / C, recommendation in bold)

1. **Scope of v1.1.0.** **A: plan 082's small store only, "bigger" stays analysis** / B: add category pages + search + paging to 082 now (M, no store needs it yet) / C: skip the small store, aim at grocery-size directly.
2. **Where a grocery-size shop would run.** **A: its own Cloudflare account and deployment (same code; prepare the config split only when it comes)** / B: multi-tenant on the kitchens' deployment, Paid plan for all / C: another host (not Cloudflare): no, the code is built on D1 / R2 / Durable Objects.
3. **Payments for a bigger store.** **A: no big store before Square is ruled on (money and GST are what make it "bigger")** / B: big store first with Paid tick + bank transfer / C: decide when a shop asks.
4. **Quantities by weight.** **A: integer quantities only (sell "500 g pack" as a product); add a `unit` column only when a shop asks** / B: decimal quantities now in 082 / C: never.
