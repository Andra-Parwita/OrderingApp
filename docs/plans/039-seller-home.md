# 039 · Seller Home: a summary of the current menu

**Status:** draft (2026-10-11), questions answered, waiting for the owner's approval. Owner's design pack `temp/home/onde-onde-home-update/` (not in git): `seller-app-home-update.md` (= `CHANGES.md`), `captures/`, `screens/Home*.dc.html`, `Main.dc.html`, `Main-Finished.dc.html`. Owner: "the current initial Orders screen may be confusing and misleading"; "that design is not what you will need to change, just the UI".
**Routing is ours to choose** (owner: "the UX design will not decide how we implement or how the routing would be, it's just UX design"); the pack's routes and code are a sketch only.
**Goal:** on tablet and desktop the seller lands on **Home**, a read-only summary of the current menu in one of five states (first time, menu not published, taking orders, cooking day, no menu running). **Orders** then shows only orders. Actions open dialogs or panels in place; only "Go to …" buttons change screens. Needs [037](037-menu-wizard-overlay.md) (the wizard as a layer) for "Continue making it".

## What the design asks, against the code today

| design | today | change |
|---|---|---|
| Home is where the seller lands after sign-in | the seller lands on `/seller` = Orders (`AppRoutes.tsx`, `OrdersWorkspace`) | `/seller` becomes Home; Orders moves to `/seller/orders` (`/seller/orders/:code` stays) |
| Left panel: Home first (icon given), then Orders · Kitchen · Pickup & delivery · Menu · Settings | `sellerNav.ts` NAV_IDS: orders, kitchen, handover, menu, settings | add `home` first |
| Phone: no Home, bottom bar unchanged | phone bar orders · handover · more | none |
| 5 states, chosen top to bottom from the menus | Orders' empty, not-published and finished states (`seller-orders/HomeStates.tsx`) | the states move to Home |
| Numbers, dish stock, orders per place, packing and handover progress, unpaid, last and earlier menus | the data all exists: `finishedAt`, dish `limit`, `takingOrders`, the `packed` flag, `collectedAt`, pickup places, past weeks | **no database change** |
| Number tiles link to Orders "with that filter applied" | Orders has filter chips, not in the address | Orders reads a filter from the address (`?filter=unconfirmed`, …) |
| New menu dialog (cooking day, orders close, start from: empty / last menu's dishes / a saved set) | the Menu screen's new-or-past question, then `createMenu` | one shared dialog, used by Home and Menu |
| WhatsApp number dialog; earlier-menu side panel | Settings has the number; past weeks exist | new dialog and panel (existing `SlideOver`) |
| Banner collapses on scroll on Home and Orders | Orders already does (plan 014) | reuse it on Home |
| Orders with no menu running: only the last menu's summary, plus "Start the next menu from Home" | Orders also shows earlier menus, Make a new menu, Use these dishes, Not published strip, first-run checklist | remove those from Orders |
| Wizard as a modal route; a direct link opens it over **Menu** | plan 037 said over Orders | 037 follows the design: over Menu |
| Menu screens unchanged | | none |

## Stages (to confirm after the questions)

| # | stage | done when |
|---|---|---|
| 0 | Design into the repo: `Home*.dc.html` added to `uxDesign/seller/screens/`, `Main` and `Main-Finished` replaced by the new ones, `Main-Empty` removed (the pack says it is gone), `index.json` merged. | `node uxDesign/seller/capture.mjs` shoots the new boards |
| 1 | Plan 037: the wizard as a layer (fallback over Menu) | 037's tests |
| 2 | Route and nav: Home in the left panel, the landing screen on tablet and desktop | unit test: sign-in lands on Home on a tablet, on Orders on a phone |
| 3 | Home states 1, 2, 5–6 (first time, not published, no menu running), the New menu dialog, the WhatsApp dialog, the earlier-menu panel | unit tests per state; design-compare captures |
| 4 | Home states 3 and 4 (taking orders, cooking day), the tiles linking to filtered Orders, the banner collapse | unit tests; design-compare captures |
| 5 | Orders slimmed: no-menu-running shows only the last menu's summary; the first-run checklist and the moved parts removed | unit tests; e2e on Orders |

## Owner's rulings (2026-10-11)
1. Home's address: ours to choose. `/seller` is Home, and Orders is `/seller/orders`.
2. **The ordering behaviour doesn't change** (owner: "I don't want to change existing behaviour"). The server still closes customer ordering at the cut-off (D-024). The seller reopens it by moving Orders close later in Menu → Edit details. Home only shows what is happening.
3. The states, with the pack's suggestions and a hint (owner: "A"):
   - **Taking orders**; **Orders paused** (Taking orders switched off) is the same layout, with the eyebrow in the warn colour.
   - **Orders closed · cooking <day>**: after the cut-off, before the cooking day. A variant of the cooking-day state.
   - **Cooking day**: on the cooking date.
   - Closed and paused carry a hint: "Want more orders? Go to Menu and move Orders close" (a "Go to Menu" link; it changes nothing by itself).
4. Phones: no Home. They land on Orders, as today.
5. The wizard layer opened from a direct link or a refresh sits over **Menu** (the design). Plan 037 follows this.
