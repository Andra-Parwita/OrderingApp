# 013 · Demo kitchen: samples on the real server, safely

**Status:** approved by the builder (2026-10-10, 10:06: "A then", "I need it to build fast"). See [D-076](../decisions/README.md).
**Goal:** on Cloudflare, the admin can mark a kitchen as a **demo kitchen**. Only there, the signed-in seller gets "Add 50 sample orders" and "Clear samples", for showing the app off. Real kitchens (like Onde Onde) never get fake orders. Dev tools (`DEV_TOOLS`: reset everything, no sign-in) stay off in production.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Demo flag and sample marker.** Migration `0006_demo.sql`: `sellers.demo INTEGER NOT NULL DEFAULT 0` and `orders.sample INTEGER NOT NULL DEFAULT 0`. `Seller` and the seller views carry `demo: boolean`. Orders made by `addSampleOrders` set `sample = 1` (dev too). | `migrations/`, `shared/seller.ts` and contracts, `worker/db/` | tests: a new seller is not demo; sample orders are marked |
| 2 | **Admin sets it.** The admin home gets a "Demo kitchen" switch per kitchen (EN/ID). New admin route `PATCH /api/admin/sellers/:slug` with `{demo}`, admin session only, using the existing admin guard and origin check. | `worker/api/authRoutes.ts` (admin part), `worker/db/`, `src/features/admin/` | tests: admin can switch it; seller or anonymous gets 401/403 |
| 3 | **Seller routes, demo only.** `POST /api/seller/demo/samples` (adds 50 through the same `addSampleOrders`, with plan 008's answers) and `DELETE /api/seller/demo/samples` (removes only `sample = 1` orders of this seller, plus their inbox, audit and push rows). Both need a signed-in seller or chef session of **that** kitchen, the origin check, and `seller.demo`. Otherwise 403. Never `DEV_TOOLS`, never a global reset. | `worker/api/routes.ts`, `worker/db/seller.ts` | tests: a non-demo kitchen gets 403; the demo kitchen adds and clears; clear never touches a real order; another seller can't call it for this kitchen |
| 4 | **Seller buttons.** On the Orders home, where the dev buttons sit, a demo kitchen shows "Add 50 sample orders" and "Clear samples" (with a confirm) to its signed-in seller. The dev buttons stay dev-only. Same disable-while-running and toasts as plan 008. EN/ID. | `src/features/seller-orders/` (and its saga and slice), `src/api/` | tests: shown only when `demo`; double tap sends one request |
| 5 | **Customers see it is a demo.** A demo kitchen's customer menu shows a small "Demo kitchen: orders here are not real" line (EN/ID), muted, under the kitchen name. | `src/features/customer-menu/` | test: shown only for a demo kitchen |

## End of phase
- [ ] typecheck · lint · format:check · unit tests for `mocks`, `shared`, admin, seller-orders, customer-menu
