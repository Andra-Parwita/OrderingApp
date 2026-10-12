# 064 · Keep the pictures of the last 10 menus

**Status:** approved (2026-10-12, owner: "we could have like past 10 menus and it just loops").
**Goal:** finishing a menu no longer deletes its menu picture (the collage). Each kitchen keeps the pictures of its **10 newest past menus**; when an 11th finishes, the oldest past menu's picture is deleted (rolling). **Past menus** show their picture, and a new menu can **reuse** a past menu's picture ("Use this picture") instead of uploading again. Storage stays tiny: ≤ 10 × 600 KB ≈ 6 MB per kitchen.

## Rules
- Finish (by hand or the automatic midnight finish) keeps `picture_ref` on the finished menu. After finishing, prune: past menus beyond the 10 newest lose their picture (`picture_ref = NULL`) and the R2 object is deleted **only if nothing else uses it** (`dropUnusedImageRefs`, which already checks usage, so a picture reused by the current menu is kept).
- "Start from a past menu" copies its picture too (same ref, no new upload). In the menu picture slot: "Use a past menu's picture" opens the last 10 with their pictures.
- Replacing or removing the current menu's picture deletes the old file only if no past menu still uses it (same usage check).
- Past menus whose picture was pruned show "No picture kept" quietly (EN + ID).
- The number 10 is one constant in `shared/limits.ts`.

## Stages
| # | stage | files | done when |
|---|---|---|---|
| 1 | Server: finish keeps the ref; the rolling prune of 10; reuse copies the ref; usage-checked deletes | `worker/db/menus.ts`, `worker/api/routes.ts` (finish + picture routes only), `worker/images/r2.ts` if needed, `shared/limits.ts`, `shared/menusContract.ts` (past menu view carries its picture) | mocks: 11 finishes → 10 pictures kept, the oldest's object deleted; a reused picture survives its past menu being pruned and the current menu's replace |
| 2 | Client: Past menus show the picture; "Start from" copies it; "Use a past menu's picture" in the picture slot | `src/features/seller-menu/` (after plan 061) | unit |

## End of phase
- [ ] typecheck · eslint · touched unit tests · e2e `seller-history`, `archived-orders`
- **Deploy impact:** ⚠️ **migration 0015** (`past_weeks.picture_ref`, add-only; the builder found finished menus live in `past_weeks`) on the live D1 **before** deploying. Pictures of menus finished **before** this deploy are already gone; it starts keeping them from the next finished menu.
