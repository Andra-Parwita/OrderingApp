# Roadmap

**Owner, 2026-10-13:** "we need to add a roadmap: Square payments, adapting this for a simple store or online store (limited products), and adapting it as an event / ticketing mechanism."

Today's product is deliberately small (see [overview.md](overview.md) and the [concept brief](../../briefs/food-ordering-concept-brief.md)): one home cook, a menu per cooking day, **no payments**, no customer accounts, no phone numbers in the cloud. Each item below changes one of those rules, so each starts as its own plan with the owner's rulings ([D-055](../decisions/README.md)) before any build.

## Now (updated 24 Oct)

| version | what | plans | state |
|---|---|---|---|
| 1.0.36 – 1.0.37 | dish pictures, About, pickup map, device time zones, admin layout, Help in the seller app; private orders | 067, 075–081 | ✅ live 17 Oct |
| 1.0.38 – 1.0.41 | admin short message, Remember me (optional passkey), security touch-ups, banner on every page, notice pills, nudges, the "/" welcome page | 086, 087, 089, 092–097 | ✅ live 17–18 Oct |
| 1.0.42 (+ .1, .2) | code clean-up, seller edits any order, Customers list, On the day selling, compact Home/Cook, kitchen print, WhatsApp numbers from any country | 098 st. 0–3, 100, 103–110 | ✅ live 19–20 Oct |
| 1.0.43 | dish choices + a note per line, new-menu notices, "What's new" pill, new seller icon | 111, 112, 113 (part), 117 | ✅ live 20 Oct |
| hotfix 1.0.43.1 | slow networks (no double orders), loading splash, picture flash and scroll fixes | 114, 115 st. 1 | ✅ live 21 Oct |
| **hotfix 1.0.43.2** | **the saved page opens at once, the splash with the kitchen's icon and name shows at once** (no more black second) | 115 st. 2 | 🔨 built, gate green 24 Oct; waiting for deploy |
| **1.0.44** | one seller app per kitchen; Android customer app per kitchen, order links inside the kitchen; no migration, kill switch | [101](../plans/101-seller-app-per-kitchen.md), [102](../plans/102-android-customer-app.md) | ⬜ approved 24 Oct: both, with all safeguards, on a day with no open DellaVee menu ([risk review](../reports/2026-10-20-101-102-risk.html)); next: phone proof |
| after 1.0.44 | seller "Send a problem report" | [116](../plans/116-seller-problem-report.md) | 💤 |

**Open small items:** the 6 chef permissions from the 1.0.42 role review (ask one at a time); faster tooling ([091](../plans/091-faster-tooling.md)); the rest of [113](../plans/113-fewer-db-round-trips.md); Help screenshots from the live app; the customer app Lottie round (waiting for the owner's animations); kitchens in many countries → move `shared/zone.ts` to Temporal (owner A, 16 Oct; only if we go multi-country).

## v1.1.0: store, kinds, events (analysis only, own feature branch)
Owner, 18 Oct: "we don't have to implement yet … for now it is analysis, maybe for v1.1.0"; "we will then do a feature branch later". One model for kitchen, shop, events and community (menu = event, order = ticket), a shared seller frame with per-kind screens: [098](../plans/098-extensible-core.md); a small store ("Sandra's Store", 100 products, 20 categories): [082](../plans/082-simple-store.md); a bigger grocery store / separate deployments: [099](../plans/099-bigger-store-analysis.md). The store keeps the no-flash rule (lesson 31). The directions below are the background for it.

## Later: three directions
### 1 · Square payments
- **What:** customers pay when they order (card, Apple Pay / Google Pay) through **Square**; the seller sees "paid" on the order; refunds on cancel.
- **What it changes:** the brief's "no payments" rule; order states gain *paid / refunded*; a Square account per kitchen (OAuth connect), webhooks into the Worker, secrets per kitchen; the receipt/email question; fees.
- **Open questions:** pay at order or at pickup? Optional per kitchen? Who holds the money (each kitchen's own Square)? Tips? Deposits for big orders?

### 2 · A simple store / online store (limited products)
- **What:** the same app for a small shop that sells a **few products** (e.g. cakes, sambal jars, frozen packs) **without a cooking day**: always open or open in windows, stock per product, pickup or delivery or post.
- **What it changes:** the "one menu per cooking day" model becomes "a catalogue, optionally with a sale window"; stock that doesn't reset weekly; variants (size, flavour); shipping.
- **Reuse:** dish library → products, stock and limits, basket, order statuses, labels, WhatsApp share, languages, Help.

### 3 · Events and ticketing
- **What:** sell **places at an event** (a cooking class, a dinner night, a market stall slot): a date and time, a capacity, ticket types (adult/child, early bird), a QR or code per ticket, check-in at the door.
- **What it changes:** a "menu" becomes an "event" with capacity instead of portions; each order produces tickets with a unique code; a check-in screen (scan or type the code, mark used); probably needs payments (direction 1) first.
- **Reuse:** publish/pause, limits ("N left"), order codes, order links, push updates, the seller's phone screens.

## How we'll approach them
1. One **discovery note** per direction (who, what they sell, how they're paid), then a plan with stages.
2. Keep the food-ordering app working unchanged: each direction is a **kitchen setting or a mode**, not a fork.
3. Payments first if ticketing needs money up front.
