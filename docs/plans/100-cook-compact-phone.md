# 100 · Cook tab compact on phones

**Status:** approved: option **B2** (owner "A", 18 Oct, mock-up `uxDesign/seller/mockups/100-cook-compact.html`). Target 1.0.42. Building.
**Owner, 18 Oct:** on a chef's Samsung phone (Chandra) the seller app "is so big". Checked on the phone: font size 3rd of 8 (normal), bold font off, screen zoom at the smallest step. So the size comes from the Cook tab itself: one dish takes about a third of the screen and the controls (Print labels, Cook | Pack, Group by, Chef, Count mode, "0 of 7 cooked") take half a screen before the first dish.

## Goal
3–4 dishes visible at once on a phone (~360–384 px wide), still readable, WCAG AA, touch targets ≥ 44 px. Same data and behaviour; tablet layout unchanged.

## Ruling
**B2** (owner "A", 18 Oct): one row per dish (count · name/unit · pickup/delivery · people · − n +, thin progress bar), notes folded into one "Notes (N)" row; controls folded: no intro text, Print labels as an icon in the Cook | Pack row, Dish | Chef + chef picker in one row, Count mode + "13 of 46 cooked · Saved ✓" in one row. Phone only; tablet unchanged.

## Stages
| # | stage | size |
|---|---|---|
| 0 | mock-up `uxDesign/seller/mockups/100-cook-compact.html` (today + 2–3 options, one frame in ID); owner picks | S |
| 1 | build the picked option in `src/features/seller-cook/` (phone layout only); EN/ID strings via i18n | S–M |
| 2 | unit tests for the row; e2e `seller-tools-batch2` (cook list) + a phone capture at 384 px; scoped gate | S |

**Must hold:** Count mode, − / +, "Saved ✓", group by Dish/Chef, notes, Pack tab and labels work as today. Lint D-006 (theme tokens only).
**Deploy impact (expected):** client only, no migration, no secret. Live check: Cook tab on a phone, tick a dish, Pack tab.

## Related (same day, not in this plan)
- Samsung tablet, Chrome: Orders page wider than the screen (rail cut on the left, prices on the right). Not reproduced in Playwright at six tablet sizes; likely Chrome's "Desktop site" mode (waiting for the owner). Two real small spills found: the "Not paid" chip is clipped below ~1,100 px, and New order / "…" spill at 712 px portrait.
