# 028 · A Helper role for the kitchen team

**Status:** approved by the builder (2026-10-10). From the owner's handover doc ("Roles and permissions").
**Goal:** an owner invites helpers (for example family at a stall). A helper signs in on their own device with a passkey, sees orders with their items and paid status, can mark items sold out, scan a customer's QR and mark an order collected, and can do nothing else.

## What a helper may do (from the handover doc)

| | Helper |
|---|---|
| See orders: items and paid status | yes, read only |
| Mark sold out | any item ([D-082](../decisions/README.md)) |
| Scan QR, mark collected | yes |
| Sell on the day, adjust stock | yes, once plan 029 is built |
| Menu, settings, sharing, invites, change or cancel orders, change paid, backup | no |

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Data.** Team members get a kind: the `chefs` table gains `kind TEXT NOT NULL DEFAULT 'chef' CHECK (kind IN ('chef','helper'))`. The account role stays `chef`; the kind decides what the person may do. This avoids rebuilding `accounts`, whose role CHECK can't be altered in SQLite. Migration at the next free number. | `migrations/`, `worker/db/seller.ts`, `shared/sellerContract.ts`, `shared/authContract.ts` (`Me` carries `kind`) | tests: an existing chef reads as `chef`; a helper reads as `helper`; restore of an old backup keeps everyone a chef |
| 2 | **Server rules.** Next to `chefMayNot`, a `helperMayNot` lets a helper read orders, set sold out, and mark collected; everything else that writes is refused with 403. Checked per request, not in the UI. | `worker/api/routes.ts` | tests: each allowed call works for a helper; every other write gives 403 |
| 3 | **Invite and list.** Settings → Chefs becomes "Team": invite a chef or a helper (the same invite key flow), and each row shows its kind. | `src/features/seller-setup/` (ChefsScreen, i18n), `src/features/admin/` (the kitchen's people list shows the kind) | tests: inviting a helper makes a helper; the list shows the kind |
| 4 | **Helper's app.** A helper sees Orders (read only: no edit, cancel or paid buttons), the Kitchen view's sold-out toggle, and Hand over (scan and collected). The rail and menus hide the rest. | `src/app/sellerNav.ts`, `src/app/SellerRail.tsx`, `src/features/seller-orders/`, `src/features/seller-saturday/` | tests: a helper's rail shows only those; order buttons are hidden; e2e one helper flow on the phone |

## End of phase

- [ ] typecheck · lint · format · `mocks` route tests for helpers · seller-orders, seller-setup, seller-saturday unit tests · e2e `seller-setup` and the new helper spec (`--workers=1`)
- [ ] The owner invites a helper on the live demo kitchen and tries it on a phone

## Decisions and notes

- **Chefs also scan and mark collected** ([D-081](../decisions/README.md)); they can already update order status today, so nothing changes for chefs here.
- **Chefs editing their own dishes** is [plan 030](030-chef-own-dishes.md), built after this one.
