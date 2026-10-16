# 067 · A picture for each dish, shown to customers

**Status:** draft for **after the next deploy** (owner, 13 Oct: "B: for next round or after this is deployed, plus do we allow sellers to load dish pictures?"). Today dishes have **no picture** at all: the only food picture is the menu's one collage (plan 060's "menu picture").
**Goal:** a seller (owner or the dish's chef) can add **one picture per dish** in the dish library (phone or tablet); customers see a small picture on each dish row (loaded as they scroll), tap to enlarge; the label/print stay text-only.

## Rules (owner, 16 Oct: picture size "A")
- **One picture per dish**, square **600 × 600**, resized and compressed on the seller's device before upload to **about 100 KB** (a camera photo never reaches R2 at full size).
- **At most 300 dish pictures per kitchen** (≈ 30 MB). Estimate: 10 full kitchens ≈ 300 MB, 3% of the R2 free 10 GB; uploads and views stay under 1% of their free limits.
- Pictures are served with long browser caching, so returning customers don't fetch them again.
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
