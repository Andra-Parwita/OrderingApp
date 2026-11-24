# 131 · New menus stay open 1 more day by default

**Target:** next small release (with the owner's other updates of 15 Nov). **Status:** owner "A" (15 Nov); collecting the other updates first.

## Why (owner, 15 Nov, after the DellaVee event)
"The event day, we can close the day after by default instead of the night of the menu event time." Today a menu finishes by itself at midnight at the end of the cooking day (or the last delivery day); "Keep the menu open 1 more day" (plan 126) is off by default.

## What (owner "A")
- **Settings → Menu defaults:** a new switch "Keep new menus open 1 more day" / ID, **on by default** for every kitchen (stored in `kitchen_settings`, add-only column, default 1).
- A **new** menu starts with its "Keep the menu open 1 more day" switch set from that default (so on, unless the kitchen turned the default off). The seller can still switch it off per menu.
- Menus already made are not changed.

## Stages
| # | what | proof |
|---|---|---|
| 0 | mock-up of the Menu defaults row | owner OK |
| 1 | column + settings + new-menu default, EN/ID | unit + mocks |
| 2 | scoped gate, captures (tablet) | logs |

**Deploy impact:** one add-only migration (`kitchen_settings` default column), applied before the Worker.
