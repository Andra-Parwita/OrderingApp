# 069 · Per-chef portions and income

**Status:** approved (2026-10-13, owner). Owner: "in the seller app, in Home and also past menu and active menu, is there a summary of per-chef income?" (there was none). Owner's design: one button that opens a panel; whether chefs see it is a kitchen setting ("B": **on** by default).
**Goal:** one **Per chef** button next to a menu's order total opens a panel listing every chef with **portions** and **income** (pre-orders and stall sales shown separately), then **Whole kitchen** (dishes with no chef) and a **Total**. Owners always see all chefs; a chef sees a **My income** button with only her own line, when the kitchen setting **"Chefs can see their own income"** is on (default **on**); helpers never.

```
[ Per chef ]  →  Per chef · Sat 17 Oct                         ✕
                 chef            portions   pre-orders   stall   income
                 Chef Wati             46      $440.00  $72.00  $512.00
                 Chef Dewi             31      $378.50      —   $378.50
                 Whole kitchen         18      $162.00      —   $162.00
                 Total                 95                     $1,052.50
```

## Rules
- **Where:** Home (tablet), on the current menu's card next to "N orders · $total"; phone Orders, under the header's day totals; Past menus, each menu's detail. One button, one shared panel (side panel on tablet, full screen on phone); chefs sorted by income, Whole kitchen last; scrolls with many chefs.
- **What counts:** order lines of orders that are not cancelled (the same rule as the existing totals), grouped by each line's dish chef at the time of the menu; plus day sales (plan 029) for that menu. Delivery fees, if any, are not chef income (shown nowhere in the table). Money in the kitchen's currency format.
- **Who:** owner: all; chef: own line only, button "My income", only when the setting is on (server enforces it: the endpoint answers a chef with only her line, or 403 when off); helper: 403.
- **Setting:** Settings → Team, owners only: "Chefs can see their own income" (EN) / "Koki bisa melihat pendapatannya sendiri" (ID), default on. Store it with the kitchen settings; prefer the existing settings/preferences storage; if it needs a column, migration `0016_chef_income.sql` (add-only, default 1).
- One server endpoint per menu: `GET /api/seller/menus/<current|pastId>/chef-summary`; a single query (or one batch), not one per chef.
- EN + ID for every text.

## Stages
| # | stage | done when |
|---|---|---|
| 1 | server: summary endpoint (current + past menu), role rules, the setting | mocks: owner sees all chefs with right sums (cancelled excluded, stall sales included); chef sees own line when on, 403 when off; helper 403; one round trip |
| 3 | **keep it for past menus** (owner "A", 13 Oct): when a menu finishes (by hand or the hourly finish), save its per-chef summary as a snapshot on the past menu (migration 0017, add-only: a JSON column on `past_weeks`); the past-menu summary reads the snapshot; menus finished before have none ("not kept"); a chef still sees only her own line from the snapshot | mocks: finish → snapshot saved with the right rows; past menu answers from it after the next menu starts; chef sees own line; older menu → not kept |
| 2 | client: the button in the three places + the shared panel + the setting toggle | unit: owner/chef/helper visibility; panel totals; setting off hides the chef's button |

## End of phase
- [ ] typecheck · eslint · unit · e2e `seller-history`, `seller-batch1`, `helper-flow`
- **Deploy impact:** none, or migration 0016 (add-only) if the setting needs a column.
