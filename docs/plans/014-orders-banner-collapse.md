# 014 · Orders home: collapse the banner so the list gets the room

**Status:** approved by the builder (2026-10-10, screenshots of the live demo: "the master order list has too much image, I should be able to expand the list to go up and cover the image a bit (show only like 50px on top) … currently I can only see 5 or 6 rows"; with an order open, only 2 rows show). Built before the stakeholder demo, so keep it small.
**Goal:** on the seller's Orders home, one tap slides the order area up over the banner, leaving a 50 px strip of the picture, so the list and the order detail get about 115 px more. Tapping again restores the full banner. The choice is remembered on that device.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Collapse toggle.** A small icon button with a chevron (⌃ / ⌄), with the aria-label "Show more orders" / "Show the banner" (EN/ID) and `aria-expanded`, sits at the top edge of the Orders panel (the right end of the header row is fine). Collapsed, the banner area is 50 px tall: the same picture, cropped, with `object-position` keeping its middle. The change animates with a short height transition (skipped under `prefers-reduced-motion`). The state is kept in `localStorage` (try/catch, default expanded). Tablet, desktop and phone Orders home only. | `src/app/SellerLayout.tsx` and/or the banner component it uses, `src/features/seller-orders/OrdersTableScreen.tsx`, `PhoneOrdersScreen.tsx`, the i18n (EN/ID) | a test: the toggle collapses and restores and the state survives a remount; e2e `seller-list-scroll` still passes |
| 2 | **No visible scrollbar under the status tabs.** The status tabs (All, Ordered, …) scroll sideways when narrow but hide the scrollbar (`scrollbar-width: none`, plus `::-webkit-scrollbar { display: none }`); the active tab scrolls into view. | the status tab bar component in `src/features/seller-orders/` or `src/ui/` | visual check by the coordinator |

## End of phase
- [ ] typecheck · lint · format:check · seller-orders and app unit tests · e2e `seller-list-scroll` on desktop and mobile · capture at 1180 × 820 collapsed, with an order open
