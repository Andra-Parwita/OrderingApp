# 051 · Add and edit dishes on a phone

**Status:** approved (2026-10-12, owner asked "can the phone seller app be used to add dishes?"; included in this round: "deploy later tonight for all I asked").
**Goal:** on a phone, owners and chefs can open their dish list, add a dish and edit a dish (the dish editor laid out for a narrow screen). Making a menu (the wizard), publishing, saved sets and Settings stay tablet/computer only.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Phone route.** `/seller/menu/dishes` (owners) and the chef's "Your dishes" `/seller/menu` are no longer in `TABLET_ONLY` on phones; the rest of `/seller/menu*` stays tablet-only. A **Dishes** row in the phone's More. | `src/app/sellerNav.ts` (+test), `src/app/AppRoutes.tsx` (More row) | unit: on a phone `/seller/menu/dishes` renders the list; `/seller/menu/make/dishes` still shows "open on a tablet" |
| 2 | **Phone layout.** The dish list and the dish editor fit 360–430 px: one column, full-width fields, the save bar at the bottom, the chef modal (plan 049) full screen. | `src/features/seller-menu/` (DishesScreen, DishEditor styles) | captures at 390 × 844: list, new dish, edit dish; nothing cut off |
| 3 | **A chef adds her dish to the current menu** (owner, D-094). Server: a chef may `POST` a current-menu item only for a dish whose chef is herself (draft or live menu); everything else on the menu stays owner-only. The dish editor for a chef shows "Also add to the current menu" (and "Add to menu" on her dish in "Your dishes"). On a live menu customers see it at once. | `worker/api/routes.ts` (chefOwnDishMay), `src/features/seller-menu/` (DishEditor asChef, ChefMenu), i18n | tests: a chef adds her own dish to a draft and to a live menu; another chef's dish → 403; publish still 403 |

## End of phase
- [ ] typecheck · eslint · `src/app`, `src/features/seller-menu` unit tests · a phone capture check
