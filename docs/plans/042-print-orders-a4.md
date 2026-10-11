# 042 · Print the current menu's orders on A4

**Status:** approved (2026-10-11), **in this round** (owner: "include the print"; button placement "A"); screenshots of the printed pages after the build instead of a mock-up first. First asked (owner: "can we have the ability to print current orders per menu on some A4 pages, so the seller can also have a hard copy? If not, we will plan it for the next one after this planned deploy").**Goal:** from Orders, the seller prints the current menu's orders as a clean A4 hard copy: the browser's own print (or "Save as PDF"), no new dependency. Labels stay where they are (Kitchen → Print labels; phone: More → Labels).

## What prints (proposal, to confirm in the mock-up)
- **Header on every page:** kitchen name, "Menu for <cooking day>", printed at <time>, page N of M.
- **Orders, grouped by pickup place and time, then delivery:** one compact row per order: code, first name, items with quantities, note (if any), Paid / Not paid, status. A tick box to mark by hand.
- **Totals at the end:** per dish (pre-ordered and sold on the day, from plan 029), orders count, total, paid and unpaid.
- **Options:** which orders (all / not collected / not paid); sort by place or by code.
- A4 portrait, black on white, 10–11 pt, no banner or colours; page breaks never split an order.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 0 | ~~Mock-up~~: screenshots / PDF of the printed pages after the build, for the owner. | — | owner OK |
| 1 | **Print view.** a **🖨 Print** button in the Orders header next to Scan (tablet and desktop); on a phone, **More → Print orders** next to Labels (owner: "A") opens a print preview of the pages above with the options, and a Print button (`window.print()`, `@media print` rules like `src/components/labels/LabelSheets.tsx`). EN + ID; the print uses the seller's language. | `src/features/seller-orders/` (new PrintOrders), `src/app/AppRoutes.tsx` (route), i18n | unit: groups and totals match the orders; a cancelled order is left out; e2e: the preview renders 2 pages for 30 orders |

## End of phase
- [ ] typecheck while building
- [ ] lint · format:check · seller-orders unit tests · the new e2e spec (`--project … --no-deps`)
- [ ] a real print or "Save as PDF" checked by the owner
