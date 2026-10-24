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
| **hotfix 1.0.43.2** | **the saved page opens at once, the splash with the kitchen's icon and name shows at once** (no more black second) | 115 st. 2 | ✅ live 24 Oct (brief rollback: VPN false alarm); iPhone check ✅ |
| **hotfix 1.0.43.3** | **customers download only the customer app** (1.86 MB → 891 KB; menu about 0.85 s instead of 1.3 s on a phone); iPhone dark-spotlight launch picture instead of black; no network wait for the splash script | [119](../plans/119-customer-bundle-split.md) | ✅ live 24 Oct |
| **1.0.44** | one seller app per kitchen; Android customer app per kitchen, order links inside the kitchen; fewer database trips; anonymous statistics (admin app) and nudges in My orders; smaller phone banner (about 100 KB); **one add-only migration (0034)**, kill switch | [101](../plans/101-seller-app-per-kitchen.md), [102](../plans/102-android-customer-app.md), [118](../plans/118-join-kitchen-switcher.md) (join another kitchen in Settings, switch by the kitchen name, language in Settings), [113](../plans/113-fewer-db-round-trips.md) (items 3–7), [121](../plans/121-stats-and-nudges.md) (statistics + nudges), smaller customer banner, [122](../plans/122-ios-status-bar.md) (iPhone status bar), My orders per kitchen (D-120), no duplicate Remember me accounts | ✅ live 25 Oct 07:02 (Worker `5c5ee9c4…`), live checks ✅; gate: unit, full e2e 130/0, emulator multi-kitchen ✅ ([risk review](../reports/2026-10-20-101-102-risk.html)) |
| after 1.0.44 | seller "Send a problem report" | [116](../plans/116-seller-problem-report.md) | 💤 |

**Open small items:** the 6 chef permissions from the 1.0.42 role review (ask one at a time); faster tooling ([091](../plans/091-faster-tooling.md)); Help screenshots from the live app; ~~the customer app Lottie round~~ dropped (owner 24 Oct: "we don't need animation for customer app, we will keep it simple for now", D-116); kitchens in many countries → move `shared/zone.ts` to Temporal (owner A, 16 Oct; only if we go multi-country).

- **iOS-style large titles (idea, after 1.0.44; owner "A" 25 Oct):** on pages without a banner (My orders, Settings, Basket, order page) a big bold title under the see-through status bar that collapses into a small sticky title on scroll, like native iPhone apps. Mock-up first.
- **Taller phone banner (later):** 1200 × 570 so the banner's own scene continues behind the iPhone clock (plan 122 note); today the kitchen's background picture fills that strip.
- **More languages (e.g. Tagalog):** app texts only ≈ 1 day (a third i18n set + switches); kitchen content (dish names) needs a data model change from `name_en`/`name_id` columns to any number of languages — plan with v1.1.0.

## v1.1.0: store, kinds, events (analysis only, own feature branch)
Owner, 18 Oct: "we don't have to implement yet … for now it is analysis, maybe for v1.1.0"; "we will then do a feature branch later". One model for kitchen, shop, events and community (menu = event, order = ticket), a shared seller frame with per-kind screens: [098](../plans/098-extensible-core.md); a small store ("Sandra's Store", 100 products, 20 categories): [082](../plans/082-simple-store.md); a bigger grocery store / separate deployments: [099](../plans/099-bigger-store-analysis.md). The store keeps the no-flash rule (lesson 31). The directions below are the background for it.

## Later: three directions

- **Store apps (Google Play, App Store):** one ShaggyBobo app with a kitchen picker and invites; web shell vs React Native vs native, with a pick and a staged roadmap: [app-store-roadmap.md](app-store-roadmap.md) (analysis, 24 Oct; **parked**: website only for the near future, D-118).
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
