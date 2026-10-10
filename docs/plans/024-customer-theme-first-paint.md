# 024 · Customer pages show the kitchen's current theme from the first paint

**Status:** approved by the builder (2026-10-10: "seller can change it any time .. something to reflect the menu offered"). Queued after plans 021 and 023.
**Today:** the theme arrives with the menu, so the customer sees the default Onde colours for a moment, and My orders and Settings opened directly keep the default.
**Goal:** the customer always sees the kitchen's **current** theme. The seller may change it for each menu (for example Bali for a Balinese week), so the server's value always wins and nothing stale is kept.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Theme in the HTML.** The Worker's head rewrite from plan 011 also sets `<html data-brand="<theme>">` and `<meta name="theme-color">` for kitchen and order pages, read fresh from the DB on every load (no caching beyond the existing no-cache on rewritten pages). `AppThemeProvider` starts from `data-brand` before the first paint. | `worker/api/kitchenPage.ts`, `worker/pages.ts`, `shared/kitchenHeadLinks.ts`, `src/theme/` | tests: the HTML for a Bali kitchen carries `data-brand="bali"`; the first render uses it |
| 2 | **Pages without a kitchen in the URL** (My orders, Settings): use the last kitchen's theme, refreshed each time a menu or order of that kitchen loads (the server value always replaces it). Changing the theme in the seller app shows on the customer's next page load or menu refresh. | `src/theme/kitchenBrand.ts`, `src/api/device/lastKitchen.ts` | tests: My orders opened directly uses the last kitchen's theme; a new theme from the server replaces the stored one |

## End of phase
- [ ] typecheck · lint · format · `shared`, `src/theme`, the customer unit tests · e2e `kitchen-links` and `customer-batch1` (`--workers=1`)
