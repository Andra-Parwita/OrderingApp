# 037 · Menu wizard as a layer

**Status:** draft (2026-10-11), waiting for the owner's approval and the mock-up. Builds on the builder's plans 027–035 (branch `plan/flow-and-prototype`, commit 84c4b31), which also change `src/app/AppRoutes.tsx` (a kitchen switcher, More links) and `src/app/sellerNav.ts` (Kitchen and Labels allowed on phones).
**Phones:** `/seller/menu` (and so the wizard) is tablet-only (`TABLET_ONLY` in `sellerNav.ts`), on `main` and on his branch. This plan keeps that, so the layer is for tablet and desktop; a phone wizard would be its own decision.
**Goal:** Make a menu (Dishes → Details → Check → Publish) and a live menu's Edit tabs open **as a layer over the screen you're on** (Orders, Menu, and later Home). The tab underneath doesn't change, and closing returns you there. Today the wizard is a page under the Menu tab, so opening it from Orders switches the tab (owner: "we should not move from one menu item to another unless it's say, go to menu, go to kitchen, go to settings"). Owner's choice: option A, react-router modal routes. No database change.

## How it works today
- The routes are `/seller/menu/make/:step` and `/seller/menu/edit/:step` (`src/app/AppRoutes.tsx`, `MakeMenuRoute`), a full page inside `SellerLayout`. Each step is in the address (`src/features/seller-menu/steps.ts`, `stepPath`), and the furthest step reached is saved on the server (`wizardStep`), so a draft survives leaving.
- The tab is chosen from the address (`src/app/sellerNav.ts`, `activeNav`): `/seller/menu/...` means Menu.
- The Orders screen sends you to `/seller/menu` (`src/features/seller-orders/HomeStates.tsx`, the Make-menu, Continue and use-dishes buttons), and the Menu screen then opens the wizard. That's two jumps.
- Close goes to `/seller/menu`; Publish's "Go to orders" goes to `/seller` (`src/features/seller-menu/MakeMenuScreen.tsx`).
- Nothing in the app uses modal routes yet. The overlays we have are `ui/SlideOver.tsx`, `ui/patterns/BottomSheet.tsx` and the dialogs.

## Design
- **Background location:** a launcher calls `navigate(stepPath(...), { state: { background: location } })`. When `background` is set, the main `<Routes>` renders the background screen (so `SellerLayout`, its tab and the screen behind stay as they were), and a second `<Routes>` renders the wizard in the layer. `useLocation` under `<Routes location={background}>` returns the background, so `activeNav` needs no change. Check this in a unit test.
- **Inside the wizard:** Back, Next and the progress bar carry `location.state` forward, so the layer stays open. The browser's Back still steps back through the wizard.
- **Close (and Esc):** returns to `background` (`navigate(background, { replace: true })`). Publish's "Go to orders" stays an explicit trip to Orders.
- **Opened from a direct link, or with no background** (bookmark, a new tab): shown over the Menu screen (`/seller/menu`), as in the owner's Home design (plan 039).
- **Refresh:** the history state survives a reload, so the layer and the screen behind come back.
- **One helper** opens it from anywhere, for example `useMenuWizard()` returning `open(step?)` and `start()`. `start()` is the Menu screen's new-menu flow (the new-or-past question, then `createMenu`), moved out of `MenuScreen.tsx` so Orders, Menu and the future Home share it.
- **The layer:** tablet and desktop only (phones keep the tablet-only message). The owner picks in the mock-up between a full-height panel over the screen and full screen. `role="dialog"`, `aria-modal`, the focus is kept inside and returned on close, and its own Close button. The dish editor (`DishEditorHost`) opens on top of it.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 0 | **Mock-up** (before any UI build): the layer on tablet (1180 × 820) and desktop (1361 × 865), opened from Orders, with the Orders tab still lit. The owner approves it. | `uxDesign/seller/` | owner OK |
| 1 | **Modal routes:** background location in `AppRoutes`; the wizard routes rendered a second time in the layer when `background` is set (still behind `SellerGuard` / `SellerOnly`); state carried through the steps; Close and Esc return to the background; fallback over Menu. | `src/app/AppRoutes.tsx`, `src/features/seller-menu/MakeMenuScreen.tsx`, `src/features/seller-menu/steps.ts`, a new layer component in `src/ui/` | unit test: opened from `/seller`, the Orders tab stays current and Orders stays rendered; Next keeps the layer; Close returns to `/seller`; a direct link shows the layer over Menu |
| 2 | **Open from anywhere:** `useMenuWizard()` (open, start). The Orders buttons open the wizard directly (start, or continue at the saved step); the Menu screen uses the same helper. | `src/features/seller-menu/useMenuWizard.ts` (new), `src/features/seller-menu/MenuScreen.tsx`, `src/features/seller-orders/HomeStates.tsx` | unit test: Make-menu on Orders opens Dishes with no tab change; Continue opens the saved step |
| 3 | **Look** per the mock-up (as chosen), theme tokens only (D-006), EN/ID for any new label (e.g. the Close label). | the layer component, `src/i18n/*` if needed | screenshots at 1180 × 820 and 1361 × 865 match the mock-up |

## End of phase
- [ ] typecheck while building
- [ ] lint · format:check · unit tests for `src/app`, `src/features/seller-menu`, `src/features/seller-orders`
- [ ] e2e `design-compare` (Menu-Dishes, Menu-Details, Menu-Check, Menu-Publish) and `live`; update `harness/seller-menu.tsx` if its routes need the state

## Open
- **Menu screen as a summary** (owner: "this wizard can also be done on the menu, so the menu screen could then be a summary"). Once the wizard is a layer, the Menu screen no longer hosts it and can become a summary of the current menu, opening the layer to make or edit. Owner's ruling (2026-10-11): **its own plan**, designed together with the Home summary (both summarise the current event), after the owner's design. Not part of this plan.
- Use-dishes button on Orders (`HomeStates.tsx`, third call site): check in stage 2 whether it should open the wizard or the Dishes library.
