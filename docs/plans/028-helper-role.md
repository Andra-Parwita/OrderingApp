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
| 1 | **Data and contract** (re-planned 2026-10-11 after 033: a third **membership role** `helper`, not `chefs.kind`; 033 made `memberships.role` the one place that says what a person may do). Migration **0010** rebuilds `memberships` and `auth_keys` (and re-points `auth_key_redemptions`) with `role IN ('owner','chef','helper')`; `CHECK (role <> 'chef' OR chef_id IS NOT NULL)` stays, so a helper has `chef_id` NULL. Add `helper` to `ROLES`/`MEMBERSHIP_ROLES`, the `Me`/`Membership`/`TeamMember`/`InviteRequest` types and parsers, `callerRoleOf` and the session, device and key queries. A helper's `Me` has `role: 'helper'`, `displayName`, no `chefId`. | `migrations/0010_helper.sql`, `shared/authContract.ts`, `shared/domain.ts` (`StaffActor`, per the audit ruling), `worker/db/auth.ts`, `worker/db/rows.ts` | tests: existing owner and chef memberships unchanged by 0010; a helper invite redeems into a helper membership with no `chef_id`; `Me` and `/memberships` carry `helper`; a chef invite without `chefId` is still refused |
| 2 | **Server rules.** A deny-by-default `helperMay(method, a, b, c)` allowlist next to `chefMayNot` (`worker/api/routes.ts` ~551): read orders, set sold out, collected/status; everything else gives 403, including `invites`, `team`, `chef-invites`, `backup`, `demo` and all menu, settings and `made` writes. The helper's actor name comes from `displayName` (no chef row). | `worker/api/routes.ts` | tests: each allowed call works for a helper; every other write (and `GET` on `backup`/`team`) gives 403; owners and chefs unchanged |
| 3 | **Invite and list.** "Helper" in the Team screen's role select (`TeamScreen.tsx`; the cook picker stays chef-only); the role shows in the list, the kitchen switcher (`KitchenSwitcher.tsx` today says owner or chef) and the admin people list. | `src/features/seller-setup/` (`TeamScreen.tsx`, i18n), `src/app/KitchenSwitcher.tsx`, `src/features/admin/` | tests: inviting a helper sends `role: 'helper'` and no `chefId`; the list and switcher show "Helper" |
| 4 | **Helper's app.** `helper` counts as staff (`isStaff` in `session.tsx`), lands on Orders, and sees only Orders (read only), the sold-out toggle and Hand over; the rest is hidden in the rail, menus and settings. | `src/app/session.tsx`, `AppRoutes.tsx`, `guards.tsx`, `SellerLayout.tsx`, `SwitchPerson.tsx`, `sellerNav.ts`, `SellerRail.tsx`, `src/features/seller-orders/`, `src/features/seller-saturday/`, `orderText.ts` | tests: a helper's rail shows only those; order edit, cancel and paid buttons are hidden; e2e one helper flow on the phone |

## End of phase

- [ ] typecheck · lint · format · `mocks` route tests for helpers · seller-orders, seller-setup, seller-saturday unit tests · e2e `seller-setup` and the new helper spec (`--workers=1`)
- [ ] The owner invites a helper on the live demo kitchen and tries it on a phone

## Decisions and notes

- **Helper invites (owner 2026-10-11: "A"):** the same as every invite (D-085): one key, one device, within 24 hours; a second device through the 6-digit code. No new rule.

- **Audit label (owner 2026-10-11: "A"):** a helper's actions are recorded with the role `chef` in order history for now (`StaffActor`, `orders.entered_by_role` unchanged, no rebuild of `orders`). The helper's display name is still recorded. A real "helper" label is a later plan if it matters.

- **Chefs also scan and mark collected** ([D-081](../decisions/README.md)); they can already update order status today, so nothing changes for chefs here.
- **Chefs editing their own dishes** is [plan 030](030-chef-own-dishes.md), built after this one.
