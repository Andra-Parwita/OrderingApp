# 016 · Kitchen: filter by chef

**Status:** approved by the builder (2026-10-10: "also in Kitchen .. we need also filter by chef").
**Goal:** in Kitchen (Cook and Pack), a chef or the seller can show only one chef's dishes, so each cook sees just what they have to make and pack. Today Cook can only *group* by chef.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Chef filter in Cook and Pack.** A compact "Chef" control (Segmented when there are up to 4 choices, else a select): **All** · the kitchen's own name (dishes without a chef, D-012) · each chef. Cook: only that chef's dishes and totals. Pack: only orders that contain that chef's dishes, showing only those lines (the other lines are greyed, so the packer knows the order isn't complete). It is hidden when the kitchen has no chefs. When a **chef** is signed in, it defaults to that chef; otherwise All. The choice is remembered per device (localStorage, try/catch). EN/ID. | `src/features/seller-cook/` (`cookModel.ts`, `packModel.ts`, `CookTab.tsx`, `PackTab.tsx`, the i18n) | model tests: the filter picks the right dishes and orders; a component test: the control shows only with chefs, and a signed-in chef defaults to themselves |

## End of phase
- [ ] typecheck · lint · format:check · `src/features/seller-cook` unit tests
