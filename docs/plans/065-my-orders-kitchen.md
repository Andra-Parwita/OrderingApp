# 065 · My orders: remember the kitchen, and show each order's kitchen clearly

**Status:** approved (2026-10-12, owner "A": keep one list for all kitchens (D-0xx), "but in My orders it should show the kitchen name better in the card, like with a pill").
**Goal:** (1) `/my-orders` and customer Settings always know the **last kitchen** the customer opened on this device, even after a reload, so its banner, theme and the Menu tab work; (2) every order card in My orders shows its **kitchen name as a pill** (muted, with the kitchen's small logo if it has one), so a customer with orders from Dellavee and Onde Onde tells them apart at a glance.

## Rules
- Remember the last kitchen slug on the device when a kitchen menu opens (localStorage `lastKitchen`, try/catch). On `/my-orders` or customer Settings with no kitchen loaded, load that kitchen's menu (the existing menu load) for the banner and theme. No kitchen remembered → as today.
- The pill: the kitchen name from the order (orders already know their seller); tokens only, 1px hairline or soft tint, WCAG AA, not saturated. If all orders are from one kitchen, still show it (consistent).
- EN + ID for any new text (none expected beyond the name).

## Stages
| # | stage | files | done when |
|---|---|---|---|
| 1 | remember + reload the last kitchen; the pill on order cards | `src/app/AppRoutes.tsx` (MyOrdersRoute / CustomerSettingsRoute), `src/features/customer-orders/` | unit: reload on /my-orders shows the last kitchen's banner; cards show their kitchen pill; no kitchen remembered → unchanged |

## End of phase
- [ ] typecheck · eslint · unit · e2e `native-customer`, `customer-batch2`
- **Deploy impact:** none (client only).
