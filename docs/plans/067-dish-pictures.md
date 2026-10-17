# 067 · A picture for each dish, shown to customers

**Status:** ✅ built and gated (16–17 Oct; mock-up reviewed, D-103); in Release 1.0.36 (owner, 17 Oct: "B") (owner, 16 Oct: "let's do this"; earlier, 13 Oct: "B: for next round or after this is deployed, plus do we allow sellers to load dish pictures?"). Today dishes have **no picture** at all: the only food picture is the menu's one collage (plan 060's "menu picture").
**Goal:** a seller (owner or the dish's chef) can add **one picture per dish** in the dish library (phone or tablet); customers see a small picture on each dish row (loaded as they scroll), tap to enlarge; the label/print stay text-only.

## Rules (owner, 16 Oct: picture size "A")
- **One picture per dish**, square **600 × 600**, resized and compressed on the seller's device before upload to **about 100 KB** (a camera photo never reaches R2 at full size).
- **At most 300 dish pictures per kitchen** (≈ 30 MB). Estimate: 10 full kitchens ≈ 300 MB, 3% of the R2 free 10 GB; uploads and views stay under 1% of their free limits.
- Pictures are served with long browser caching, so returning customers don't fetch them again.
- **Mock-up** `uxDesign/seller/mockups/067-dish-pictures.html` reviewed (16 Oct, D-103): customer row picture on the **left**; seller dish library shows a dashed camera box for a dish without a picture, **but no boxes at all when no dish has a picture**; **Remove always asks** "Remove this picture?" first.
- Replacing or deleting deletes the old file when nothing uses it (same `dropUnusedImageRefs` rule).
- The CSV import/export carries no pictures.
- A dish without a picture shows no empty box.
- Customer rows: `loading="lazy"`, fixed size, no layout jump; works with 50 dishes (plan 066).

## Stages (sketch)
| # | stage |
|---|---|
| 1 | storage + routes (dish picture upload/remove; migration for `dishes.picture_ref`) |
| 2 | the dish editor's picture field (phone + tablet), the chef's own dishes |
| 3 | customer menu rows + tap to enlarge; Help topic 5 updated |

**Deploy impact (expected):** one add-only migration.

## Build notes (coordinator, 17 Oct)
- **Migration 0026** (add-only): `dishes.picture_ref`, `menu_items.picture_ref` (a menu holds copies of its dishes, D-062). Setting or removing a dish's picture also updates its copy on the live menu, so customers see it at once.
- **Routes:** `PUT` / `DELETE /api/seller/dishes/:id/picture` (owner; a chef only on their own dish). Upload slot `dishPicture`: square 600 × 600, server cap 200 KB; `dish_picture_limit` (409) at 300 per kitchen; files dropped only when no dish, menu copy, slot, set or past menu uses them.
- **Seller:** "Picture (optional)" in the dish editor (Take photo / Choose photo, Replace, Remove with "Remove this picture?"); a new dish gets its picture after its first save. Library rows: 40 px thumbnail or dashed camera box, none at all when no dish has a picture.
- **Customer:** 64 × 64 lazy picture on the left of the dish row (`DishesView.tsx`), tap opens the full picture with name, price and description.
- **Left out (deviations):** no Cancel / progress bar while uploading (spinner only); no thumbnails in the chef's own dish list (ChefMenu); a dish deleted while a menu copy still shows its picture keeps the file until that menu changes (no later sweep); `ItemRow.tsx` got picture code but no screen uses it (dead code: ask before removing).
- **Gate (17 Oct):** typecheck, lint, format ✅; full unit 2,274 (failures only port-busy "fetch failed" flakes; the 4 files re-ran green 47/47); full e2e 92 passed, 32 skipped; then after two fixes the menu unit tests 206/206 and e2e dish-pictures + seller-menu 3/3. Two bugs found and fixed at the gate: customer rows showed no picture (code had gone into the unused `ItemRow`), and a broken `minmax (0, 1fr)` stacked every row of Your dishes. Checked by eye in the local app: editor, library (phone + tablet), customer dishes (phone + tablet), enlarge, Remove confirm.
