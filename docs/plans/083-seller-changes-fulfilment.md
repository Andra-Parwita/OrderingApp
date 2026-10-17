# 083 · The seller changes pickup ↔ delivery and the customer is told

**Status:** approved for Release 1.0.37 (owner, 17 Oct: "important for seller to also have ability to change order delivery/pickup"); ✅ built and gated 17 Oct (D-105); not committed.
**Owner, 17 Oct:** "seller need to be able to change order from pickup to delivery or vice versa and notify customer".

## Today (search, 17 Oct)
- A seller cannot change a menu order's fulfilment or pickup place: there is no seller `PATCH /api/seller/orders/<code>`; the seller's order detail is read-only (`OrderDetailScreen`, `OrderPanelBody`).
- Only the customer can switch, before the cut-off (`PATCH /api/orders/<token>` → `updateOrder`, `worker/db/seller.ts`), and switching to pickup sets no pickup place (`patched()` ignores `pickupPlaceId`).
- Customer edits write an audit entry and "changed" but no inbox entry, so no push goes out. Private-order edits (plan 081) also send the customer nothing.

## Proposal
1. Seller route `PATCH /api/seller/orders/<code>` (owner and chef; helpers no?): fulfilment pickup | delivery, pickup place, delivery address (team-only, D-099). Works after the cut-off (the seller decides). Same for private orders through their existing edit.
2. The customer is notified: an inbox entry + web push in their language, e.g. "Your order is now for delivery to 12 King William St" / "Your order is now for pickup at Clayton, 10:00–12:00"; the order page shows the new way and the place or delivery time.
3. Seller UI: "Change" next to Pickup/Delivery on the order detail (phone and tablet): Pickup (choose place) or Delivery (address fields); Save asks "Tell <name>?" (default on).
4. Kitchen, Pack, labels and Pickup & delivery follow the new way at once (live update).

## Owner rulings
- **Who:** owners and chefs; helpers see the change but cannot make it (owner "A", 17 Oct).
- **Notify:** the seller chooses: a "Tell the customer" tick, on by default (owner, 17 Oct: "seller should be able to choose to send notification").
- **Privacy:** the "changed to delivery" notification and inbox text carry no street (EN "Your order is now for delivery." / ID "Pesananmu sekarang diantar."); pickup keeps place and times (owner "A", 17 Oct; D-099 deletes addresses a day after the menu, the inbox lives 4 weeks).
- **After the cut-off:** allowed (the seller's switch exists mainly for changes after the customer can no longer edit; owner, 17 Oct, in discussion).
- **Map links** (owner, 17 Oct: "when add delivery, also have some small button to view in map etc"): the Delivery fields in the change sheet get a small "Check on map" link; after saving, the order detail shows the quiet Directions / Map links (plan 081 style).
- **Mock-up** `uxDesign/seller/mockups/083-change-fulfilment.html` (17 Oct). Coordinator defaults: tick off → no push and no update entry, the order page still shows the new way; switching to pickup needs a place (first one preselected); delivery shows the address only (no time slot); sheet note reads "Only your team can change it then".

## Open questions (for the owner, one at a time)
- none left.

**Deploy impact (expected):** no migration (fulfilment, pickup place and address columns exist); a new route and inbox message kind.
