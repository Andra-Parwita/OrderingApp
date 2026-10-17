# 090 · Clean-up plan (later)

**Status:** collected 17 Oct; **overnight work** (owner, 17 Oct: "we will do later cleanup and split for overnight work"), after the current features land. Owner: "add in clean up plan". Behaviour unchanged unless stated; each item proved by the full tests. Source: docs/reports/2026-10-17-code-health.html (top ten) and the handover's "Known and not done" list.

| # | item | size | notes |
|---|---|---|---|
| 1 | **Split the server route file by area** (report #9): one module per area + a dispatch table | M (≈1–2 h with builders) | after plan 087; move-only |
| 2 | **Split the other large files** (plan 088): seller.ts, menus.ts, auth.ts, AppRoutes.tsx, Install/Checkout/Help screens, Orders table, Help topics | M | soft limit under 750 lines, no tiny-file sprawl |
| 3 | **One source for the kitchen's orders** (report #7): Kitchen (Cook/Pack) reads from the Orders copy; one live loop | M (≈ couple of hours) | half the requests |
| 4 | **One current-menu store and one live-refresh helper** (report #10) | L | removes "change it in three places" |
| 5 | **Chef permissions as an allow-list** (report #8) | M | a new route can't leak to chefs by accident |
| 6 | **Shared UI parts: Tag and Notice** (+ Overlay primitive, Button variants, compact Segmented, ListRow; adopt Stepper/EmptyState) (report #6) | M | convert screens as they are touched; ≈1,000–1,500 lines saved |
| 7 | **One corner-radius token set; lint catches rem literals too** (report #4) | S | |
| 8 | **Sweep expired invite keys and device codes** | S | |
| 9 | **Remove old route names and the old chef-invite route** (`chefMayNot` dead names, `POST /api/seller/chef-invites`) | S | |
| 10 | **Customer order tokens out of the live-socket address** (`?tokens=`) | S–M | privacy tidy-up |
| 11 | **Theme colours defined once** (`shared/kitchenManifest.ts` copy) | S | |
| 12 | **Playwright projects by tag, not file name** | S | |
| 13 | **Lint memory** (needs 8 GB today) | S | |
| 14 | Old roadmap doc folder section | S | docs only |

Done already from the report: #1 salted IP hash, #2 security headers, #3 dead code, #5 order limit (plan 089).
