# 063 · One clear choice: Pickup, Delivery or Both

**Status:** approved (2026-10-12, owner "A"). Builds after plan 061 (shares `src/features/seller-menu/` and the customer basket).
**Goal:** today "pickup only / delivery only / both" is implied (tick places, switch delivery on or off). The menu's **Details** step gets one clear choice at the top, **"How do customers get their food?" Pickup · Delivery · Both** (ID: "Bagaimana pelanggan mendapat makanannya? Ambil sendiri · Diantar · Keduanya"), and shows only the matching settings: pickup places and times for Pickup; the delivery note for Delivery; both for Both. A delivery-only menu works end to end for customers.

```
How do customers get their food?
[ Pickup ] [ Delivery ] [ Both ]
  Pickup locations ☑ Glenelg 10–12  ☑ Clayton 11–13      (Pickup / Both)
  Delivery note    "From 4 pm, $5 inside 10 km"           (Delivery / Both)
```

## Rules
- No new storage: the choice is derived from today's data (places ticked + `delivery.available`) and writes the same fields. Switching to Delivery un-ticks the places only on save, and asks first if places were ticked ("Remove the pickup places from this menu?").
- ~~Settings → Menu defaults gets the same three-way choice~~ **Owner (13 Oct, A): not needed; Menu defaults stays delivery on/off, the choice is per menu.**
- Check step: "Pickup only" / "Delivery only" / "Pickup or delivery" in its summary; the "no place and no delivery" worry stays for the impossible mix.
- Customers: the menu page already says Pickup / Pickup or delivery / Delivery only; the basket/checkout must handle **no pickup places** (today it assumes `points[0]`): delivery is preselected and no pickup picker shows.
- EN + ID. Help topic 6 updated to the new control.

## Stages
| # | stage | files | done when |
|---|---|---|---|
| 1 | Details step + Menu defaults three-way choice | `src/features/seller-menu/DetailsStep.tsx`, settings Menu defaults pane, i18n | unit: each choice shows only its settings; Delivery from ticked places asks first; saves the same fields |
| 2 | Customer delivery-only checkout | `src/features/customer-menu/CheckoutViews.tsx` (+ basket) | unit + e2e: a delivery-only menu orders end to end; pickup-only unchanged |
| 3 | Check step wording + Help topic 6 | `CheckStep.tsx`, `src/features/seller-help/topics.ts` | unit |

## End of phase
- [ ] typecheck · eslint · touched unit tests · e2e `customer-batch1`, `seller-menu`
- **Deploy impact:** none (no migration, same data).
