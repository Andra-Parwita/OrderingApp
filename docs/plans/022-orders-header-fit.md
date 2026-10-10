# 022 · Orders header: nothing overlaps on the iPad

**Status:** approved by the builder (2026-10-10, live screenshot on the iPad: "the Not paid and Dishes buttons are overlapped; some of those can be just tabs under it, and the orders should have just a menu to add an order and edit dishes"). It fixes a bug from plan 015 (the header overflows at about 1060 px of content width; search is squashed to "Nar"). Starts after plan 018, which adds a Scan button to the same header.

## Layout

- **Row 1 (header):** "Orders · Live", the Taking-orders switch, a **Search** icon button, **Scan** (icon button, plan 018), **+ New order**, **⋯** (Dishes · Share menu · the "Menu for … · Orders close …" line), and the banner toggle.
- **Row 2 (tabs):** All · Ordered · Confirmed · Ready · Done · Cancelled, then a hairline divider, then **Changed 11** and **Not paid 27** as toggle tabs (`aria-pressed`), so they filter together with the status tab, as they do today. The row scrolls sideways without a visible scrollbar when narrow.
- **Dishes** opens the plan 015 slide-over from the ⋯ menu. Its total portions show in the menu item.

- **Search** (builder, 11:47: "even search can be a button that shows the text box underneath or on top and replaces the tabs underneath; the idea is to be space conscious and efficient"): tapping it swaps the tabs row for a full-width search field (focused) with a close ✕; Esc or ✕ clears and brings the tabs back. While a search is active, the icon shows a dot.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | Header and tabs as above; no fixed pixel widths; check at 1180, 1024 and 820 px wide (the iPad portrait and landscape content widths) that nothing overlaps or clips. Phone unchanged except that Dishes also moves into its ⋯ menu if the phone has one (else it keeps its current button). EN/ID. | `src/features/seller-orders/OrdersTableScreen.tsx` (and its tab bar), tests, e2e specs that click Changed, Not paid or Dishes | unit tests by role and name; Playwright screenshots at 1180×820, 1024×768 and 820×1180 looked at by the coordinator, with no overlap |

## End of phase
- [ ] typecheck · lint · format · seller-orders unit tests · e2e `seller-list-scroll` and any spec touched (`--workers=1`)
