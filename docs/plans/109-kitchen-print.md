# 109 · Kitchen print: the cook list on paper

**Status:** in **1.0.42** (owner, 18 Oct: "we need to include in this build"); mock-up first, then build.
**Owner, 18 Oct:** "We need to include in this build a kitchen print so a chef can print for the kitchen, or can print all in the kitchen to be cooked, and including notes too if whoever wants to print it includes it."

## What it is
A printable cook list from the Kitchen (Cook) screen, next to "Print labels":
- **Whose:** one chef's dishes (a chef prints their own; owner picks a chef) or **all** dishes to cook.
- **What:** per dish the total portions (and pickup/delivery split as the Cook tab shows), grouped by dish or by chef like the Cook tab.
- **Notes (optional):** a tick "Include customer notes" adds the notes (order code + name + note) under the list.
- A4, readable at arm's length, ticks to cross off by hand; header: kitchen, menu date, printed time, "Chef: Chandra" or "All chefs".

## Today (to confirm in code)
Cook tab has "Print labels" (bag labels, 2×7 A4) and Orders has "Print orders"; no cook-list print. An old kitchen print job was removed in 1.0.38 (check git history only for reuse ideas). Uses existing data only (Cook slice: dishes, counts, chefs, notes); no server change expected.

## Stages
| # | stage | size |
|---|---|---|
| 0 | mock-up `uxDesign/seller/mockups/109-kitchen-print.html` (screen choice + printed page, EN/ID); owner picks | S |
| 1 | print view + Print button on the Kitchen screen (tablet + phone), choice remembered on the device | S–M |
| 2 | unit tests + e2e (print preview renders, notes on/off, per chef); scoped gate | S |

**Deploy impact (expected):** client only; no migration.

## Owner answers
- **No cooked count on paper** (owner, 18 Oct: "no need to show count, just how many orders per dish, for how many people"): per dish the portions to cook and how many people/orders they are for (e.g. "7 lalampa · for 3 people"), as the Cook tab's 👤 count; tick boxes stay.
- **Chef = A (owner, 18 Oct):** a signed-in chef starts with their own dishes and can select All chefs (or another chef).
- **Preview first = A (owner, 18 Oct):** Print opens a preview page (like Orders print), then the browser print.
- **All prints work the same way (owner, 18 Oct: "all print same way"):** Orders print, bag labels and kitchen print share one flow: a "Which…" choice at the top, a preview page, then Print; same look of the choice controls and header.
- **Pages (owner, 18 Oct):** continuous by default, with a tick "New page per chef" in the choice sheet (shown when grouped by chef / All chefs).
- **Private orders = an option (owner, 18 Oct):** the print choice sheet has a tick "Include private orders" (with the other options: whose, group by, notes, new page per chef); when ticked, private portions count in the totals with "(N private)" beside the dish. All 109 questions answered; build after 108.
