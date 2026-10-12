# 049 · Edit chefs without leaving the dish

**Status:** approved (2026-10-12, owner: "A" — "add it as a modal so it never closes the add dish"). Bug: in the dish editor, "Edit chefs" (`src/features/seller-menu/DishEditor.tsx` ~311, `navigate('/seller/chefs')`) leaves the screen, so an unsaved dish is lost (and the wizard layer closes).
**Goal:** "Edit chefs" opens the chef list in a modal on top of the dish editor. The dish being typed stays exactly as it was; a chef added in the modal is in the picker (and selected) when the modal closes.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Chefs modal.** The chefs screen's content (`src/features/seller-setup/ChefsScreen.tsx`, the cook list: add, rename, remove) is reused inside a modal (the project's dialog/SlideOver pattern, focus kept inside, Esc and ✕ close, focus back to "Edit chefs"). Features can't import each other, so the app layer injects it (as plans 037/041 did with slots). On close the chef list reloads; a chef added there is selected in the dish's picker. Nothing in the dish form resets. | `src/features/seller-menu/DishEditor.tsx`, `DishEditorHost.tsx`, `src/features/seller-setup/` (export the cook list body), `src/app/AppRoutes.tsx` (the slot) | unit: typing a dish, opening Edit chefs, adding "Budi", closing → the dish's fields are unchanged and "Budi" is selected; Esc closes; no navigation happened |

## End of phase
- [ ] typecheck · eslint · `src/features/seller-menu` and `src/features/seller-setup` unit tests
- [ ] e2e `chef-dishes` and `seller-setup` (one at a time, `--no-deps`)
