# 088 · Split the large files

**Status:** draft (17 Oct, owner: "I also don't like large files, so we also need to split them better"); part of the **cleanup plan, overnight work, later** (owner, 17 Oct: "the files don't need to be done now, that would be the cleanup plan"). Behaviour unchanged; tests prove it.
**Source:** docs/reports/2026-10-17-code-health.html (§1, giant files).

## Largest files today (lines)
| file | lines | split idea |
|---|---|---|
| worker/db/seller.ts | 1,819 | by area: orders (place/edit/status), settings, backup/CSV, customers, demo |
| worker/api/routes.ts | 1,698 | one route module per area (public menu/orders, seller orders, menus, private, settings, admin, customer) + a small dispatcher table |
| worker/db/menus.ts | 1,386 | menu lifecycle (create/publish/finish), items, past menus, pictures |
| worker/db/auth.ts | 1,319 | passkeys, sessions, invites/codes, admin, rate limits |
| src/features/seller-help/topics.ts | 1,005 | one file per topic (content) |
| src/app/AppRoutes.tsx | 996 | route groups per app (seller, customer, admin) + the route components |
| InstallScreens.tsx | 963 | one file per platform screen |
| CheckoutViews.tsx | 919 | one file per checkout step |
| HelpScreen.tsx | 843 | layout vs. topic rendering vs. print |
| OrdersTableScreen.tsx | 756 | table, filters, toolbar |

## Rule going forward (proposal)
**Soft limit: under 750 lines per file** (owner, 17 Oct: "less than 750 lines, but not too strict, since sometimes it's easier in one file, and not too many files"). Split by area only where it helps; no tiny-file sprawl. A gentle warning above 750, not a hard failure.

## Stages (sketch)
1 worker/api/routes.ts by area · 2 worker/db/seller.ts, menus.ts, auth.ts · 3 src/app/AppRoutes.tsx + the big screens · 4 Help topics per file · each stage: move-only refactor, typecheck, full unit + the affected e2e, no behaviour change.
