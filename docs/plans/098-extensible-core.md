# 098 · An extensible core: one model for kitchen, shop, events and community

**Status:** analysis for the owner (Fable, 18 Oct, read-only review). **Owner, 18 Oct: "we don't have to implement yet what Fable recommends; for now it is analysis, maybe for v1.1.0 where it may include the small Sandra store functionality."** So: §1, §1b and everything kind-, store- or events-related is **analysis, target v1.1.0** (with plan 082's small store, mock-up "Sandra's Store"); the clean-up stages in §2–§3 (088 + 090 merged) are the **near-term candidates**, decided separately. Cut by the three implementation principles: every item names the concrete problem it fixes (over 750 lines, risky, blocks extension); "nicer only" items are listed under *deferred* with the reason; dead code is a question, not a deletion.
**Goal:** the owner can add a simple store (082), later Square payments and event ticketing, by adding *labels, a few rules and a few screens*, not by copying the kitchen. **This plan changes no behaviour, adds no migration and no new abstraction**; it documents the model, splits the files that block work, and fixes the three things that would leak or stale.
**Owner, 18 Oct:** "I want it to be clean before adding store and later in roadmap like payment and event ticketing ... mostly simple UI/label and data structure mainly same ... menu = event, order = ticket etc."

## 1. The core abstraction (analysis, v1.1.0; the finding: the tables already fit)

The owner's instinct is right. Today's tables and types are already the general model; a shop or an event changes **words, a few rules and two or three screens**, nothing in the shape of the data. So the recommendation is *a kind on the place plus vocabulary and rules per kind*, not a new model and not a framework.

| concept | kitchen (today) | shop (082) | event organiser | community activity | today's table / type (unchanged) |
|---|---|---|---|---|---|
| **Place** (one `kind`, set at creation) | kitchen | shop | organiser | group | `sellers` + `kitchens`; `Seller`, `Kitchen` |
| **Offering** (what is open for orders) | menu: dated, cut-off, finishes | catalogue: undated, never finishes | event: dated, "sales close" = cut-off, finishes | activity: dated | `menus`; `MenuView` |
| **Item** | dish | product | ticket type (limit = capacity) | spot | `dishes` (library), `menu_items` (copy on the offering); `MenuItem` |
| **Order** | order | order | booking (lines = tickets) | sign-up | `orders` + `order_lines`; `SellerOrder` |
| **Fulfilment** | pickup / delivery | pickup / delivery | entry at the door (= pickup) | attend (= pickup) | `orders.fulfilment` |
| **Hand-over** | scan the QR → Collected | collected / delivered | scan the QR → "Checked in" | attended | `collected_at/by`, the existing scan flow |
| **Closing** | finish → `past_weeks` | monthly archive (082) | event over → past event | past activity | `past_weeks` |
| **Places** | pickup places | counter / shop | venue | venue | `pickup_places` |
| **Team** | owner / chef / helper | owner / helper | owner / door staff (= helper) | organiser / helper | `memberships.role` |

**Where the differences live (three layers, and only these):**

1. **Vocabulary (labels).** i18next's `context` option keyed by the place kind: `t('order.title', { context: kind })` reads `order.title_events` if it exists and falls back to `order.title`. Today's 3,049 EN/ID strings stay (200 say "menu", 124 "dish"); a kind adds only the strings that differ. Nouns used inside sentences ("your menu", "a dish") come from one small `vocab` block (`offering`, `item`, `order`, `handover`). One hook, `usePlaceKind()`, reads the kind from the customer menu payload or the seller session. No module, no registry of labels.
2. **Rules.** One small table, `shared/kinds.ts`: `KIND_RULES[kind] = { offering: 'dated' | 'open', cutoff, finishes, stock: 'limit' | 'counter', handoverSteps, categories, cooks, maxItems }`, read by the Worker and the app. Plan 081 already did this one level down (`orders.kind`, the `LIVE_MENU` fragment); 082's guards (`ordering()` skips the cut-off, `finishDueMenus` skips an open offering, the stock counter) become rows in this table instead of `if (mode === 'store')` in five places.
3. **Screens.** Kind-specific only where the *layout* differs (store grid with categories; the event page). Everything from the basket on is shared and takes its words from layer 1: checkout, order placed, order page, My orders, statuses, push, Orders table, Pack, hand-over scan, labels, income.

**Smallest migration path.**

- **With the store (082 stage 1, not now):** one add-only migration: `sellers.kind TEXT NOT NULL DEFAULT 'kitchen' CHECK (kind IN ('kitchen','shop','events','community'))` (this replaces 082's `sellers.mode`) and `menus.kind` (`menu` | `catalogue` | `event`). `Seller.kind?` in `shared/domain.ts`, absent = `kitchen`, so old payloads, backups and fixtures keep working. Layers 1 and 2 are built **in that plan, with their first consumer**; building them now would be an abstraction for single-use code.
- **Events later:** no new tables. A ticket type is a menu item with a limit; `ready_for_pickup` is skipped by the kind's `handoverSteps`; "Checked in" is the Collected scan with a label; a venue is a pickup place. `fulfilment = 'entry'` is not needed until a kind must hide the pickup/delivery choice; then one CHECK rebuild (0007 / 0010 style).
- **Never rename** `menus`, `dishes`, `cooking_date`, `past_weeks` or the type names `MenuItem`, `SellerOrder`. The mapping table above goes into `docs/architecture/data-model.md` (stage 0); the docs translate, the code does not.

**Payments (Square, later).** The hooks exist: `orders.paid`, `orders.deposit_cents`, `past_weeks.paid_cents / unpaid_cents`, the Paid tick, the audit entry `paid`. After the Square ruling: one table `order_payments (seller_id, order_id, provider, provider_ref, amount_cents, state, created_at)`, `paid` derived from it, no provider columns on `orders`. Payment belongs to the Order, not to the kind, so every kind gets it at once. Nothing to do now.

## 1b. Shared frame and building blocks (analysis, v1.1.0; owner, 18 Oct)

**Owner:** "Seller or organiser app could be slightly different with rows to cater more orders (tickets as order items/dishes) but we can have the same layout or frame so it's familiar ... reusable components or layout as shareable styled components or frame would be useful."

**The frame already exists and is kind-neutral.** Every seller kind would use, unchanged: `SellerLayout` (274 lines), `SellerRail` (423), `PhoneBar` (123), `ShellBanner` (111) + `KitchenBanner` (38, one banner on every page, plans 093/094), the floating notice pills (`src/components/notice/NoticePill.tsx`, 124: `NoticeSlot`, `Pill`, `PillButton`, `PillRow`, `PillClose`), and the kit's `TabBar`, `PageHeader`, `BottomSheet`, `SlideOver`, `FullLayer`, `ListWithPanel`, `WarningDialog`. The customer side has the same (`CustomerShell`, 244). The only kind-specific thing in the frame is the navigation, and `src/app/sellerNav.ts` is already pure data (`NAV_IDS`, `HREF`, `ICON`, helper subset): a kind later supplies its nav rows (`navFor(kind)` from the rules table) and its labels (vocabulary). **Nothing to build in the frame now.**

**What repeats today outside the kit** (non-test `.tsx` under `src/features`, `src/components`, `src/app`; counted 18 Oct):

| piece | hand-made today | the kit already has | where it clusters |
|---|---|---|---|
| buttons (`styled.button`) | **116** | `Button` (variants), `IconButton`, `ConfirmButton` | seller-menu 10 files, seller-orders 9, customer-menu 7, admin 5 |
| tags / badges (`*Tag`, `*Pill`, `*Badge`, `*Chip = styled`) | **21** | `Pill` (status tones) | `NewTag` twice (`LiveOrderRow.tsx:69`, `PhoneOrderRow.tsx:34`), `MyOrdersView.tsx` ×3 |
| inline notices (`*Notice`, `*Banner`, `*Hint`, `*Warning = styled`) | **31** | nothing inline (`NoticePill` is the floating one) | `OrderPageView.tsx` ×5, `SellerLayout.tsx` ×3, `guards.tsx` ×2, one each in 11 more files |
| sheets / overlays / dialogs | **25** | `BottomSheet`, `SlideOver`, `FullLayer`, `WarningDialog`, `patterns/modal.ts` | `OrderPageView.tsx` ×4, `InstallScreens.tsx` ×4, `menuShared.tsx`, `ReleasesPanel.tsx`, `MenuHomeView.tsx`, `ChangeFulfilment.tsx` ×2 each |
| rows (`*Row = styled`) | **70** | `ListRow`, `Table` / `TableRow` / `TableCell` (used only by `seller-home/Live.tsx` and `SellScreen.tsx`) | `CheckoutViews.tsx` ×4, `AdminHomeScreen.tsx` ×4, `MenuHomeView.tsx` ×3 |
| **order rows** | 3 components, 2 of them twins: `LiveOrderRow` (210: Code, Name, NewTag, Flag, Items, Total, How, Paid cells on a `1fr auto` grid), `PhoneOrderRow` (186: the same cells), `OrderRow` (69); `PrivateListScreen` (333) has its own list | nothing | `src/features/seller-orders/` |

**Inside the files C7 splits** (what a split would copy into two files): `CheckoutViews` 2 buttons, 1 notice, 4 rows; `InstallScreens` 4 buttons, 4 sheets, 2 rows; `OrdersTableScreen` 4 buttons; `HelpScreen` 5 buttons.

**Extract now (C8a, before C7, concrete repetition):**

1. **`Notice`** (inline, tones info / warn / error, optional action): the one part that repeats 31 times and has no kit equivalent. New `src/ui/Notice.tsx`; convert only the screens stages 1–2 touch (the 1 in `CheckoutViews`, the 3 in `SellerLayout` if C6 touches it); the other 27 convert when their screen is next edited, never in a sweep.
2. **Order-row cells** (`src/features/seller-orders/orderRowCells.tsx`): the cells `LiveOrderRow` and `PhoneOrderRow` both define (Code, Name, Items, Total, the "new" tag as the kit `Pill`, paid / changed marks) become one set; both rows compose them. Two copies → one, inside one feature, ≈ 150 lines fewer. This is also the seam the owner asks for: a row is a list of cells, so a kind later passes a different cell list (tickets per booking, check-in state) and a density, **without a new screen** — but the option itself is not built until a kind needs it.
3. **Adopt the kit where C7 splits a file:** `Button` for the 15 `styled.button`s in the four C7 files where a variant fits (keep the styled one where it does not; no new variants), `BottomSheet` / `FullLayer` for `InstallScreens`' 4 sheets if they fit, `ListRow` for `CheckoutViews`' line rows if it fits. No sweep of the other 101 buttons, 19 tags or 21 sheets.

**Build with the store / events plan (v1.1.0 or later), not now (C8b):** the per-kind customisation points, each driven by the kind's rules and vocabulary rows, never by a forked screen: (a) `navFor(kind)` rows for the rail and phone bar; (b) the order row's cell list and density per kind (ticket count, check-in state); (c) extra order actions from `handoverSteps` (e.g. "Check in" rendered by the existing order panel from the rules row, labelled by vocabulary); (d) the store's product card / grid and the event page (new layout, the only new screens); (e) a `Tag` with non-status tones only if the store needs one (`Pill` covers today's 21). Not invented before a kind exists.

**What blocks extension today (the only three things found):** `worker/api/routes.ts` is one 1,709-line function with hand-written role checks (a store route is added by growing it, and `chefMayNot` is a deny-list, so a new route leaks to chefs unless someone remembers); the layering rule forbids feature → feature imports, so a `customer-store` folder could not reuse the checkout that lives inside `customer-menu`; and the current menu is held in four slices with one live loop each (report §2), so "the offering" has no single place to read. The first is fixed here (C1, C2); the other two are fixed in the plan that first needs them (see *deferred*).

## 2. The clean-up items (near-term candidates), with the concrete problem each fixes

Line counts measured 18 Oct. Behaviour: none, unless stated.

| # | item | concrete problem | files | size | risk |
|---|---|---|---|---|---|
| D0 | **Docs: the mapping table** (§1) in `data-model.md`; 082 points `mode` → `kind` | the next plan would otherwise invent its own model | `docs/architecture/data-model.md`, `docs/plans/082-simple-store.md` | S | none |
| C1 | **Routes split by area** (090 #1, 088 st.1): `routes.ts` → `publicRoutes`, `sellerOrderRoutes`, `menuRoutes`, `privateRoutes`, `settingsRoutes`, `adminRoutes`, `devRoutes` + a dispatch table | **1,709 lines**, 111 routes, every feature edits it; blocks extension | `worker/api/*` | M | medium: matching order; the `mocks/` route tests cover it |
| C2 | **Roles as an allow-list** (090 #5): the dispatch table carries `roles` per route; `chefMayNot` / `helperMay` go | **risky**: a deny-list leaks a new route to chefs by default (report #8) | with C1 | M | medium: needs a role-matrix test listing every route (the matrix must come out identical) |
| C3 | **Database files by aggregate** (090 #2, 088 st.2): `seller.ts` → orders, order flags, backup + CSV, demo; `menus.ts` → lifecycle, items, past menus, pictures; `auth.ts` → passkeys, sessions, keys + codes, admin, rate limits. `Repository.ts` unchanged | **1,819 / 1,386 / 1,322 lines** | `worker/db/*` | M | low: move-only, `mocks/` runs the real code |
| C6 | **App routes split** (088 st.3): `AppRoutes.tsx` → `customerRoutes`, `sellerRoutes`, `adminRoutes`, `MoreRoute`; `AppRoutes` composes | **997 lines** | `src/app/*` | M | low |
| C7 | **Split the screens over the limit** (088 st.3–4): `seller-help/topics.ts` 1,074 (one file per topic), `InstallScreens` 963, `CheckoutViews` 905, `HelpScreen` 843, `OrdersTableScreen` 756. (`DetailsStep` 735 and `AdminHomeScreen` 732 are under: left alone) | **over 750 lines** | those folders | M | low |
| C8a | **Shared parts that repeat today** (090 #6, cut down; §1b): new `src/ui/Notice.tsx` (31 hand-made inline notices, no kit part); `seller-orders/orderRowCells.tsx` (the cells `LiveOrderRow` and `PhoneOrderRow` both define); adopt `Button`, `Pill`, `ListRow`, `BottomSheet` / `FullLayer` only in the four files C7 splits. No sweep, no new variants | **repetition a C7 split would double** (15 buttons, 4 sheets, 6 rows in those files); two twin order rows | `src/ui/Notice.tsx` (new), `src/features/seller-orders/*Row.tsx`, the C7 files | S–M | low–medium: visual diffs, checked by the two design-compare specs |
| C5 | **One source for the kitchen's orders** (090 #3): Cook/Pack read the Orders slice; `cookSaga` drops its own fetch and live loop | **cost**: Orders + Cook open = every change fetched twice on the free plan | `seller-cook`, `seller-orders` | M | medium |
| C10 | **Sweep expired invite keys and device codes** (090 #8) | **grows for ever**: `auth_keys` / `auth_codes` rows are never deleted after expiry | `worker/db/retention.ts`, `worker/api/scheduled.ts` | S | low |
| C12 | **Order tokens out of the live-socket address** (090 #10): `?tokens=` → first message | **privacy**: private tokens in a URL can land in logs | `worker/api/routes.ts` (live), `src/features/customer-orders/liveConnection.ts` | S–M | medium: old open tabs reconnect once |
| T1 | **Lint memory** (090 #13 → plan 091) | **gate unreliable**: lint ran out of memory (8 GB) | per 091 | S | low |

**Deferred, with the reason** (each waits for its first consumer or a ruling; kind / store / events rows are **v1.1.0 or later**):

| item | why not now | when |
|---|---|---|
| `Seller.kind`, `shared/kinds.ts`, `usePlaceKind()` / `t(..., { context })` | no consumer: an abstraction for single-use code | 082 stage 0 (first thing the store builds) |
| E4: move checkout (`BasketScreen`, `CheckoutViews`, `AddressSection`, `OrderPlacedScreen`, `basketDraft`, the basket slice) from `customer-menu` to `customer-checkout` | blocks the store (feature → feature imports are forbidden), but the move has no proof until a second reader exists | 082 stage 0, or now if the owner prefers (Q3) |
| C4: one offering slice + one live-refresh helper (090 #4) | **L**, the riskiest item; it is not broken today (the stale copy is the one whose screen is closed); its first real need is the store's catalogue read | the plan that first needs one offering read; Q4 |
| contracts split (`shared/menusContract.ts`, 728) | under the limit | when the store's contract pushes it over |
| C8b per-kind customisation points (nav rows, order-row cell list + density, "Check in" action from `handoverSteps`, product card / grid, event page) and a non-status `Tag` | §1b: driven by rules and vocabulary rows that do not exist yet; the seam (cells) is made by C8a | the store plan, the events plan |
| the other 101 hand-made buttons, 19 tags, 27 notices, 21 sheets | repetition, not a defect; a sweep is adjacent work across every screen | each converts when its screen is next edited |
| C9 radius tokens + rem lint, C13 theme colours once, C14 Playwright tags, C16 roadmap doc | "nicer"; nothing broken | 091 (C14) or never |
| `fulfilment = 'entry'`, `handoverSteps`, categories, stock counter, monthly archive, `order_payments` | per-kind rules and payments | the store plan, the events plan, the Square ruling |

**Dead code (questions, not deletions):** the report and the handover name five candidates. Delete? (Q5.) `PrintJob` in `src/components/labels/LabelSheets.tsx:230` (exported, never imported); the cook `label` i18n block in `src/features/seller-cook/i18n/en.json` + `id.json` (`seller-labels` has its own copy); the dead names in `chefMayNot` (`worker/api/routes.ts:823`, goes with C2 anyway); `POST /api/seller/chef-invites` (older chef-only invite; no client calls it); the old route names (090 #9).

## 3. Stages

Move-only refactors: typecheck while building; the scoped unit tests and the touched e2e specs at the end of each stage; **one release per stage** (a big move-only diff is easiest to bisect when it ships alone). Start on a clean tree after the current release (49 files are modified on the branch today).

| # | stage | items | sequential or parallel | done when |
|---|---|---|---|---|
| 0 | **Write it down** | D0, the owner's answers to Q1–Q5 → D-109 | one agent, docs only | mapping table in `data-model.md`; 082 updated |
| 1 | **Server by area** | C1 + C2 (one builder, `worker/api`) ∥ C3 (one builder, `worker/db`) | **wave of 2**, disjoint folders; `Repository.ts` frozen for both | route modules + dispatch table with roles; a role-matrix test lists every route and matches today; `mocks/` green; no Worker file over 750 |
| 2 | **App files over the limit, shared parts** | C6 first (it edits imports); C8a next (`Notice`, order-row cells, so the splits use them); then C7 as (Install + Help + topics) ∥ (Checkout) ∥ (OrdersTable); then C5 | C6 → C8a sequential → **wave of 3** → C5 sequential | no `src/` file over 750; `Notice` in the kit; one set of order-row cells; Cook without its own loop; `seller-*`, `customer-*`, install and the two design-compare e2e green |
| 3 | **Small fixes** | C10 ∥ C12 ∥ T1 | **wave of 3** (retention / live socket / tooling are disjoint) | each proved by its own narrow test; C12's old-client reconnect checked by hand |

**Deploy impact:** no migration. API unchanged except C12 (live-socket address: open tabs reconnect once) and, if Q5 says yes, the removed dead route. A half-done stage must not ship.

## 4. What not to do now

- **No table or column renames** (`menus` → `offerings`, `cooking_date` → `event_date`): CHECK rebuilds of every child table and a backup-format change, for no behaviour.
- **No type renames or aliases** (`type Offering = MenuView`): two names for one thing is worse than one old name.
- **No generic base classes or a generic repository**: the kinds differ in rules, not in shape; a table of rules (when the store comes) is enough.
- **No `kind` column, registry or vocabulary hook before the store** (082 stage 0 builds them with their first consumer).
- **No payments before the Square ruling**; no deposit changes.
- **No "both modes in one place"** (082 Q7), no variants, no categories, no shipping.
- **No folder renames for their own sake** (`seller-menu`, `customer-menu` keep their names; new folders use capability names: `customer-checkout`, `customer-store`).

## 5. Questions for the owner (A / B / C, recommendation in bold; Q1–Q3 are v1.1.0 design rulings, Q4–Q6 are about the clean-up)

1. **Vocabulary mechanism** (decide now, build with the store). **A: i18next `context` per kind, falling back to today's strings** / B: a full namespace per kind (every string copied) / C: `{{item}}` placeholders in every string.
2. **Where the kind lives.** **A: `sellers.kind`, set once at creation, replacing 082's `mode`** (one person can own a kitchen and a shop, 082 ruling) / B: `kitchens.kind` / C: only `menus.kind`, no place kind.
3. **Checkout move (E4).** **A: with the store, as 082 stage 0** / B: now, in this plan (M, no behaviour change, but no second reader yet) / C: never (the store's screens live inside `customer-menu`).
4. **The four copies of the current menu (C4).** **A: defer to the plan that first needs one offering read; do only C5 (double fetch) now** / B: do C4 + C5 now (L, the riskiest refactor) / C: drop both.
5. **Dead code.** **A: delete all five after a grep each, in stage 1 (routes) and stage 2 (labels, cook keys)** / B: only the two the report confirmed (`PrintJob`, cook label keys) / C: leave.
6. **Shared parts (C8a scope).** **A: `Notice` + the order-row cells + kit adoption only in the files stage 2 touches** / B: sweep every hand-made button, tag, notice and sheet now (M–L, visual diffs on every screen) / C: nothing now, all with the store.

## End of phase

- [ ] Full gate after each stage: typecheck · lint · format:check · test · the changed Playwright specs
- [ ] `pnpm run docs`; `data-model.md`, `api.md` and `source-layout.md` updated in the stage that moves files
- [ ] No source file over 750 lines: `git ls-files 'src/*' 'worker/*' 'shared/*' | xargs wc -l | sort -rn | head`
- [ ] Owner tries the customer flow on a phone after stage 2

## Owner answers (18 Oct)
- Q1, Q2 (labels per kind, where the kind lives): **saved for the store branch (v1.1.0)**.
- Q3 checkout move: **B, now in 1.0.42** (move basket/checkout/placed out of `customer-menu` into `customer-checkout`, no behaviour change; the 905-line split happens in the move).
- Q4 four menu copies: **A, only C5 (Cook reads the Orders slice) now; C4 waits for v1.1.0**.
- Q5 dead code: **A, delete each leftover after a grep confirms it's unused** (note: `PrintJob` and the cook label keys were already removed in 1.0.38 (plan 089); re-check before listing; also the unused chip/nudge helpers in `src/api/customer/state.ts` from 096).
- Q6 shared parts (C8a): **A, only in the files the clean-up splits anyway**.
- Next: write D-109, then build 1.0.42 by stages 0–3 (one release per stage unless the owner bundles them).

## Decisions and notes

- The owner's answers to Q1–Q5 go to `docs/decisions` (D-109 proposed: "Kinds of place: one model, vocabulary and rules per kind; built with the store").
- Plans 088 and 090 become "merged into 098" once this is approved; 091 keeps its own measurements (T1 is its item).
- Lesson 31 (persistent banner, no flash) and 082's "must hold in every stage" apply to any store or event screen later; this plan touches no banner code.
