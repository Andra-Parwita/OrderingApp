# 031 · Admins open a kitchen as its owner would

**Status:** approved by the builder (2026-10-10). From the owner's updated handover doc (roles table: Admin, "See and manage any kitchen's menu and orders" = yes). Builder chose a separate plan, after 027–030.
**Goal:** from the admin page, an admin opens any kitchen in the seller app with the owner's rights, under a clear "Viewing as admin · <kitchen>" banner, to help a seller. Every change an admin makes there is logged, and customers are told admins can see orders for support.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Server: admin acts in a kitchen.** An admin session can name a kitchen (`POST /api/admin/kitchens/:id/enter`, leave again); seller routes then treat the admin as that kitchen's owner. Nothing changes for any other role, and kitchen separation stays checked per request. | `worker/api/authRoutes.ts`, `worker/api/routes.ts`, `worker/db/auth.ts` | tests: an admin who entered kitchen A reads and changes A; still gets 403 on B; a seller can't call enter |
| 2 | **Log of admin changes.** Each write an admin makes in a kitchen is logged: when, which admin device (its name tells the person, D-080), kitchen, route, and what changed (the existing audit diff where there is one). Kept 10 weeks. The owner sees it in Settings. | `migrations/`, `worker/db/`, `src/features/seller-settings/` | tests: an admin change makes one log row with the device name; owner-made changes make none |
| 3 | **Admin page and banner.** Each kitchen row on the admin page gets "Open as admin". The seller app shows a fixed banner "Viewing as admin · <kitchen> · Leave". | `src/features/admin/`, `src/app/SellerLayout.tsx`, i18n | tests: the banner shows while entered; Leave goes back to `/admin`; e2e admin opens the demo kitchen |
| 4 | **Privacy note.** The customer About and privacy page (plan 019) adds one line in EN and ID: the app's two administrators can see orders to help the kitchen. | `src/features/customer-settings/`, i18n | test: the line shows in both languages |

## End of phase

- [ ] typecheck · lint · format · `mocks` admin and route tests · admin, seller-settings and customer-settings unit tests · e2e `admin` (`--workers=1`)
- [ ] The owner opens the demo kitchen as admin on the live app and checks the log

## Decisions and notes

- The shared admin account (D-080) still says who did what, because each admin change is logged with the device name.
- A native speaker checks the new Indonesian privacy line.
