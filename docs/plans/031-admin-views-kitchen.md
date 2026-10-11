# 031 · Admins open a kitchen as its owner would

**Status:** **postponed** (2026-10-11, owner: "A, as long as it's simple enough to implement, or even just make it read-only so admin can check if there is a support problem … we can even leave it out, since the admin page already has access to update the initial pages"). Not in this deploy. If it comes back: a **read-only** "view as" first (stages 1, 2, 4 without writes; no log needed). Originally approved by the builder (2026-10-10). From the owner's updated handover doc (roles table: Admin, "See and manage any kitchen's menu and orders" = yes). Builder chose a separate plan, after 027–030. Re-planned 2026-10-11 after 028–033, 038, 039 and 041 (stages below).
**Goal:** from the admin page, an admin opens any kitchen in the seller app with the owner's rights, under a clear "Viewing as admin · <kitchen>" banner, to help a seller. Every change an admin makes there is logged, and customers are told admins can see orders for support.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Schema and session** (re-planned 2026-10-11 against today's code). Migration **0013** adds `sessions.acting_seller_id` and `admin_actions(id, at, device_id, device_name, seller_id, method, route, diff)`. `auth.enter(caller, sellerId)` / `auth.leave(caller)`; `resolve` keeps role `admin` and returns `actingAs`. No new credential: the admin's own device session carries it. Ends on Leave, sign-out, expiry or device removal; a kitchen pause does not end it. | `migrations/0013_admin_enter.sql`, `worker/db/auth.ts`, `shared/authContract.ts` (`Me.viewingAs`) | unit: enter sets it; leave clears it; sign-out and expiry clear it; a pause does not end it |
| 2 | **Routes.** `POST /api/admin/sellers/:id/enter` and `/leave`. The `/api/seller` gate (`routes.ts` ~485) and `liveSeller` (~280) accept an admin with `actingAs` as the owner of that one kitchen, rechecked every request; helper and chef limits don't apply. Writes carry the actor `{role: 'seller', name: 'Admin (<device name>)'}`. What the admin may do there follows the owner's ruling below. | `worker/api/authRoutes.ts`, `worker/api/routes.ts` | tests: enter A reads and writes A; 403 on B; a seller calling enter gets 403; without `actingAs` the old 403 stays; the live socket works |
| 3 | **Log of admin changes.** Every non-GET admin write under `/api/seller/*` writes one `admin_actions` row (device name, kitchen, route, the order-audit diff where one exists); the admin image routes (plan 041) log too. Kept 10 weeks (a prune in the retention run). The owner sees it as a read-only list in Settings. | `worker/api/routes.ts`, `worker/api/authRoutes.ts`, `worker/db/retention.ts`, `src/features/seller-settings/` | tests: an admin write makes one row with the device name; owner writes make none; rows older than 10 weeks are pruned |
| 4 | **Client.** `isStaff` / `applyMe` (`src/app/session.tsx`) accept an admin with `viewingAs`; "Open as admin" in the seller panel's header (`SellerDetails.tsx`, plan 038); the notice "Viewing as admin · <kitchen> · Leave" through `useKitchenNotices()` (plan 032's slot, not a fixed banner); the nav treats it as the owner. | `src/app/session.tsx`, `src/app/kitchenNotice.tsx`, `src/app/SellerLayout.tsx`, `src/features/admin/SellerDetails.tsx`, i18n | tests: the notice shows while entered; Leave goes to `/admin`; e2e the admin opens a test kitchen |
| 5 | **Privacy note.** The customer About and privacy page adds one line (EN and ID): "the app's administrator can see orders to help the kitchen" (one shared admin account, D-080). | `src/features/customer-settings/`, i18n | test: the line shows in both languages |

## End of phase

- [ ] typecheck · lint · format · `mocks` admin and route tests · admin, seller-settings and customer-settings unit tests · e2e `admin` (`--workers=1`)
- [ ] The owner opens the demo kitchen as admin on the live app and checks the log

## Decisions and notes

- The shared admin account (D-080) still says who did what, because each admin change is logged with the device name.
- A native speaker checks the new Indonesian privacy line.
