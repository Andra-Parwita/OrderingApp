# 068 · Two kitchens on one phone: safe home-screen apps

**Status:** approved (2026-10-13, owner "A"). Owner: "if they open Dellavee and OndeOnde, what happens and what would be the app icon on the home screen? Or can they have 2?" They can (each kitchen has its own manifest, name, icon and start page); two weak spots to fix.
**Goal:** (1) each kitchen's web-app manifest carries a fixed **`id`**, so Android always treats every kitchen as its own app; (2) inside a kitchen's home-screen app, the bottom **Menu** tab always returns to **that** kitchen, not the last kitchen opened elsewhere.

## Rules
- **Manifest id:** `"id": "/<slug>"`. Chrome's implicit id today is the `start_url` (`/<slug>`), so this keeps the **same identity for apps already installed** (no duplicate, no "reinstall"). The `?start=` query must not change the id. The seller manifest (`/seller.webmanifest`, plan 048) gets `"id": "/seller"` (its start_url) for the same reason.
- **Menu tab:** when the app runs standalone (`display-mode: standalone` or `navigator.standalone`) and was launched on a kitchen page, remember that kitchen for the session (`sessionStorage`, try/catch) as the app's own kitchen; the Menu tab goes there. In a normal browser tab nothing changes (the last kitchen, as today).
- No database change. EN/ID: no new text.

- **My orders in a kitchen's app** (owner "A", 13 Oct): when running standalone with an own kitchen (the stage 2 session value), My orders lists **that kitchen's orders first**, then a folded section **"Other kitchens (N)"** / **"Dapur lain (N)"** with the rest (same cards and pills; opens on tap; hidden when N = 0). In a browser tab, as today (all, newest first).

## Stages
| # | stage | files | done when |
|---|---|---|---|
| 1 | manifest ids (customer per kitchen + seller) | `worker/api/kitchenRoutes.ts`, `public/seller.webmanifest`, their tests | test: `/k/dellavee/manifest.webmanifest` has `id: "/dellavee"` with or without `?start=`; seller manifest `id: "/seller"` |
| 3 | My orders: own kitchen first, "Other kitchens (N)" folded | `src/features/customer-orders/` (MyOrdersView/model), EN + ID | unit: standalone own kitchen → its orders on top, others folded with the count; browser tab unchanged |
| 2 | Menu tab returns to the app's own kitchen | `src/app/CustomerShell.tsx` (+ a tiny helper) | unit: standalone launched on /dellavee, then /ondeonde visited → Menu goes to /dellavee; browser tab → last kitchen as today |
| 4 | Home-screen card also above the coming-soon view (owner fix) | `src/features/customer-menu/MenuScreen.tsx` | unit: not_published menu shows the card; the seller preview does not |

## End of phase
- [ ] typecheck · eslint · unit · e2e `native-customer`, `kitchen-links`
- **Deploy impact:** none to apply. Installed apps keep working (same id as before).
