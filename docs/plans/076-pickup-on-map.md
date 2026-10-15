# 076 · Pickup points on the map

**Status:** questions answered (2026-10-15); mock-up next, then the owner's OK to build. Owner: "and ideally the pickup can also map, so in the seller app when entering pickup we may need to enter an address that can be seen on the map … has a button to open address entry … pickup will also have a map location, not actually the address being saved? so like geoposition? what do you think".
**Goal:** each pickup point can carry an address and a map pin; customers see it on a small map with Directions.

## Today
- A pickup place (`pickup_places`, migration 0003) has a place name, directions text (EN / ID) and a time window. No address, no map.
- Plan 071 (1.0.35) built the guided address form, Check on map (Google Maps Embed, `MAPS_EMBED_KEY`), Use my location and Directions for customer delivery addresses.

## Proposal
1. **Address and pin together** (Claude's advice, 15 Oct): the seller types an address (readable, easy) and may drop a pin (latitude / longitude) with Use my location or by checking the map; the pin makes the map exact (gate, car park). Not a pin alone: it means nothing to a reader and is hard to check.
2. **Seller app:** on a pickup place, a button **Add address** opens the same guided form as plan 071 (Check on map, Use my location); saved with the place.
3. **Customers:** a small map + **Directions** (opens Google Maps) for the pickup place.
4. **Not encrypted:** the seller's own place, shared on purpose (unlike customer addresses, D-099).

## Owner's answers
1. **Who sees the pickup address and map: everyone, on the menu** (owner "B", 15 Oct), so customers see where it is before ordering; also on the confirmation and order page.
2. **The address is optional** (owner "A", 15 Oct): places without one work as today; the map shows once the seller adds an address.

3. **On the menu: the address line + View on map + Directions** (owner "A", 15 Oct); View on map opens the map in a panel (like the seller's Deliveries map); no map loads until tapped. The same on the confirmation and order page.
4. **My orders too** (owner, 15 Oct): a pickup order in My orders shows the place with **View on map** (opens the map panel; slides in on tablet / computer) and **Directions** (opens Google Maps).

The address and pin belong to the saved pickup place (the seller's list), so every menu using that place shows them; changing it updates live menus at once.

## Stages (after the questions)
| # | stage |
|---|---|
| 1 | mock-up (seller pickup place with Add address; customer menu, order page and My orders with View on map + Directions) |
| 2 | migration (add-only: address, lat, lng on `pickup_places`), contracts, Worker |
| 3 | seller form (reuse plan 071 parts), customer map + Directions, EN / ID |
| 4 | tests, docs (data-model, flows) |

**Deploy impact (expected):** ⚠️ one add-only migration before deploying; no new secret (reuses `MAPS_EMBED_KEY`).
