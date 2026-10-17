# Roadmap

**Owner, 2026-10-13:** "we need to add a roadmap: Square payments, adapting this for a simple store or online store (limited products), and adapting it as an event / ticketing mechanism."

Today's product is deliberately small (see [overview.md](overview.md) and the [concept brief](../../briefs/food-ordering-concept-brief.md)): one home cook, a menu per cooking day, **no payments**, no customer accounts, no phone numbers in the cloud. Each item below changes one of those rules, so each starts as its own plan with the owner's rulings ([D-055](../decisions/README.md)) before any build.

## Now (next rounds)
| item | plan | state |
|---|---|---|
| Release 1.0.36: dish pictures (067), About page (075), pickup on the map (076), times in the device's zone (077), admin layout (078), Help inside the seller app (079), top bars push the page down (080) | 067, 075–080 | ✅ live 17 Oct (v1.0.36) |
| Private orders (Khusus): a seller makes a one-off order for an event, sends the customer its code | [081](../plans/081-private-orders.md) | built 17 Oct, not committed; for Release 1.0.37 |
| Cleanup: state duplication, sweeping expired keys/codes, dead route names, customer socket tokens out of the URL | — | listed in the handover; ask one by one |
| Help screenshots from the live app | — | to do |
| The customer app round (Lottie animations) | — | waiting for the owner's animations |
| Kitchens in many countries: move the time code (`shared/zone.ts`) to Temporal, JavaScript's new built-in date-time standard (owner A, 16 Oct; js-joda considered) | — | only if we go multi-country; until then the built-in browser tools are enough |

**Done in Release 1.0.35 (14 Oct):** live updates (074), fewer requests (072, 073), delivery addresses with Google Maps (071), maintenance notice (046), per-chef income (069), two kitchens on one phone (068), the docs site (070).

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
