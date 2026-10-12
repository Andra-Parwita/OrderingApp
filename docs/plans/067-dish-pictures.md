# 067 · A picture for each dish, shown to customers

**Status:** draft for **after the next deploy** (owner, 13 Oct: "B: for next round or after this is deployed, plus do we allow sellers to load dish pictures?"). Today dishes have **no picture** at all: the only food picture is the menu's one collage (plan 060's "menu picture").
**Goal:** a seller (owner or the dish's chef) can add **one picture per dish** in the dish library (phone or tablet); customers see a small picture on each dish row (loaded as they scroll), tap to enlarge; the label/print stay text-only.

## Rules (to confirm with the owner when the plan starts)
- Square, resized on the device before upload, **at most ~150 KB** (smaller than the 600 KB slots), so 200 dishes stay under 30 MB per kitchen (R2 free: 10 GB).
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
