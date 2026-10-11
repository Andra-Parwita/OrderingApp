# 030 · Chefs add and edit their own dishes

**Status:** approved by the builder (2026-10-10). From the owner's handover doc (roles table: Chef, "Add menu items" = yes, assigned to self; "Edit items, set limits, ordering type" = own items; "Mark sold out" = own items). Builder chose a separate plan, after 028.
**Goal:** a chef adds dishes to the kitchen's dish list (always assigned to themselves), edits their own dishes (name, price, picture, portion limit, and from plan 029 the ordering type), and marks their own dishes sold out. Everything else on the menu stays with the owner.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Server rules.** `chefMayNot` stops closing the dish routes for chefs; instead a chef may create a dish only with `chef = self`, change or sell out only a dish whose chef is self, and never delete, reassign, publish or close a menu. Checked per request against the stored dish, not the request body. | `worker/api/routes.ts`, `worker/db/menus.ts` | tests: a chef adds a dish (chef forced to self); edits own; another chef's dish gives 403; publish and delete give 403 |
| 2 | **Chef's menu screens.** A chef sees Menu with "Your dishes" only, the add button, and the dish editor without the chef picker; other chefs' dishes are hidden. Sold-out toggle on own dishes in the Kitchen view. | `src/features/seller-menu/`, `src/features/seller-cook/`, `src/app/sellerNav.ts`, i18n | tests: a chef sees only own dishes; the editor has no chef picker; e2e one chef add-and-edit flow |

## End of phase

- [ ] typecheck · lint · format · `mocks` route tests for chefs · seller-menu and seller-cook unit tests · e2e the chef dish spec (`--workers=1`)
- [ ] A chef on the demo kitchen adds a dish, and the owner sees it

## Decisions and notes

- **Owner's ruling (2026-10-11: "A"):** a chef's edit to a dish on the **live** menu shows to customers at once, like the owner's own edits today. No approval step, no notification.
