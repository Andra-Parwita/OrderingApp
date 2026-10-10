# 015 · Orders home: one-row header, one-row order buttons, Dishes as a slide-over

**Status:** approved by the builder (2026-10-10, from the coordinator's HTML mock-ups: "let's do slide over", option A: the strip, a one-row header, one-row buttons and the Dishes slide-over). It follows plan 014 (the banner strip, done).
**Goal:** about 9 orders visible at 1180 × 820 with the banner collapsed, and a large order detail; the Dishes totals open from a button instead of taking list space.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **One-row header (tablet and desktop).** One row: "Orders · Live", the Taking-orders switch, search (flexible width), Changed, Not paid, a **Dishes** button (bowl icon + total portions), "+ New order" and the banner toggle from plan 014. The menu line ("Menu for Sat 17 Oct · Orders close …") and **Share menu** move into a small ⋯ menu button in the same row (a popover with that line and the Share action). At narrow tablet widths, the search shrinks first, then the button labels collapse to their icons with aria-labels. | `src/features/seller-orders/OrdersTableScreen.tsx` (and small parts beside it) | a test: every control is reachable by role and name; Share still works from the ⋯ menu |
| 2 | **One-row order buttons.** The order detail footer is one row: the main action (Confirm / Mark ready / Mark collected …) as the wide primary button, then icon buttons with labels for WhatsApp and Paid / Not paid, and a ⋯ menu holding Lock, Nudge and Cancel order (Cancel keeps its confirm). About 64 px instead of about 270 px. | `src/features/seller-orders/OrderPanelBody.tsx` and its parts | tests: every action is still reachable and works; Cancel still asks to confirm |
| 3 | **Dishes slide-over.** The folded Dishes section above the list goes. The **Dishes** button opens the existing `DishesPanel` content in a right-side slide-over (reuse `src/ui/SlideOver` or the `SlideOverEditor` pattern), over the order detail, with ✕ and Esc to close, focus moved in and back, and editing limits or sold out working as before. Phone: the same button on the phone header opens it full width. | `src/features/seller-orders/` (DishesPanel host), `PhoneOrdersScreen.tsx` | tests: the button opens and closes it; Esc closes it; a dish edit still works |

## End of phase
- [ ] typecheck · lint · format:check · seller-orders, app and ui unit tests · e2e `seller-list-scroll` (with `--workers=1`) · a capture at 1180 × 820 (banner collapsed, order open, then with Dishes open), looked at by the coordinator
