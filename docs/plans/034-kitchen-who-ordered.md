# 034 · Kitchen: "who ordered this dish" panel

**Status:** done (2026-10-11), not deployed. The builder confirmed: "on each menu item to be cooked I can click and see who the customers are"). Builder: "in the kitchen or cooking screen, where we can also group by chef, I want to have also a button on each [dish] to open a panel of the list of people who ordered them and the count".
**Goal:** on the Kitchen → Cook tab, each dish row has a small button with its count. It opens a panel from the right listing everyone who ordered that dish: first name, order code, how many, pickup or delivery, and the order's status, with the total at the top. Tapping a person opens that order.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Panel.** A "Who ordered" button on every dish row, in every grouping (by dish, by chef, by pickup/delivery; the "by customer" grouping already shows people). It opens the existing `SlideOver` with the row's `who` list (already in `cookModel`, no new data or server call), sorted by first name, with a count and total line; respects the chef filter and "Confirmed only". Tapping a person goes to `/seller/orders/<code>`. Bilingual EN/ID. Phone: the panel is a full-height sheet. | `src/features/seller-cook/` (CookTab, a new WhoOrderedPanel, i18n), `src/ui/SlideOver.tsx` (reuse only) | tests: the panel lists the right people and quantities for a dish; the chef filter narrows it; tapping a name opens the order |

## End of phase

- [ ] typecheck · lint · format · seller-cook unit tests · a capture of the panel on iPad and phone for the builder

## Decisions and notes

- No server change; works with the current data and will keep working after plan 033.
- Built (2026-10-10): unit 43/43 in seller-cook. The panel shows name, code, qty, pickup/delivery; **order status is not shown** (`CookWho` has none; small follow-up if wanted).
