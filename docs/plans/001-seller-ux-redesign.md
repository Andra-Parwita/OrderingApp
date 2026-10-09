# 001 · Seller app UX redesign

**Status:** approved by the owner (2026-10-10); **done** (2026-10-10 05:23; stages 1–12 and the end-of-phase gate green). Owner check pending. Progress is under Notes → Progress.
**Run settings (builder, 2026-10-10):** pause for checks after stages **2, 4, 7 and 12** (answer "B"). **Stop before connecting to Cloudflare** (builder, 01:37: "I mean phase 4 as connecting it to cloudflare"; this is phase 5 in the roadmap). That comes after this plan and plan 002, so stages 3–12 run with the checkpoints above.
**Goal:** the seller app looks and works like the design in `uxDesign/seller/`: tablet first, the collapsible left panel, five colour themes, the Make-a-menu wizard with a dish library, Kitchen (Cook and Pack), Pickup & delivery by place, Settings in panes, and a small phone subset. The customer pages get only what these features need (theme, pickup place choice, menu picture, "I've collected it"); their redesign is a later plan.

## Before you start (for whoever builds this)

- **Read first:** `uxDesign/seller/README.md`, then `uxDesign/seller/docs/handoff.md`. The handoff is the spec. Boards (`screens/*.dc.html`) are a visual reference only: never copy their markup. Where a board and the handoff disagree, the handoff wins. Where the handoff and **D-069** below disagree, D-069 wins.
- **Setup on a new PC:** Node 22 (via nvm), `pnpm install`, `copy .dev.vars.example .dev.vars`, an mkcert certificate for this PC's own LAN IP into `.certs/` (see `docs/guide/tech-stack.md`), `pnpm db:seed:local`, then `pnpm dev`.
- **Checks:** while building, run **typecheck only** (`pnpm typecheck`). Write or update tests as you go, but lint, format, Vitest and Playwright run **once at the end** (D-055).
- **Every label in EN and ID** through i18n, about 30% extra width for Indonesian.
- **Commits** are the owner's (or yours, as the owner says); one commit per stage is a good rhythm.
- **There's no production data yet** (the database is local-only), so schema changes can reshape tables freely; update the seed data (`worker/db/sampleData.ts`, `scripts/seed-local.mjs`) to match.

## How to run it (auto mode, owner's instruction 2026-10-10)

- **At the start, ask the builder once** which stages to pause after so they can check the app (for example after 2, 4, 7 and 12), and whether to commit after each stage. Write the answer at the top of this file.
- **Then run stage after stage without stopping.** Pause only at those checkpoints, or for a **blocking** question: one that the plan, the handoff and the rulings can't answer and where a wrong guess would be costly. Everything else: decide, note it under "Notes" at the bottom, and go on.
- After each stage: typecheck passes, then a one-line progress note (stage, files, anything decided).
- **Speed over detail (owner, 2026-10-10):** at each checkpoint the builder runs the design-compare check **by itself**, looks at the result, fixes anything clearly off (wrong layout, missing section, wrong colours), and carries on. A broad check of the main screens is enough: **dark theme, Onde Onde brand, each board's default state**. No light-mode or per-theme passes, and no pixel-level polishing now.

## Rulings this plan relies on

| # | Ruling |
|---|---|
| D-055 | Typecheck only while building; full gate at the end. |
| D-056, D-063 | Menus on any day. One menu at a time: not published → live → finished. A new menu only after the live one is finished. |
| D-057, D-067 | Phone is a subset: live orders, order detail, New order, Pickup & delivery, More. Same routes, adaptive by width; phone below ~600 px so upright tablets get the full app. |
| D-058, D-065 | Nav: Orders · Kitchen · Pickup & delivery · Menu · Settings. No "More" on tablet (phone only). |
| D-059 | Customer phone number and delivery address saved **on the seller's phone only** (device storage), never on the server or tablet; with a number, WhatsApp opens that chat; export / import to a file. |
| D-060 | One picture per menu (3:2, 1200 × 800, optional). Per-dish pictures later. |
| D-061 | Up to 5 saved pickup places, each with its own time; each menu ticks which it uses and may change a time for that menu only; customers pick one. |
| D-062 | Warn, never block: menus, dishes, orders, delivery steps, messages. |
| D-064 | Five themes (Onde Onde, Bali, Sumatra, Sunda, Jawa) × light/dark. The seller picks the theme for the kitchen; that seller's customer pages use it. Light/dark/auto is per device. |
| D-066 | Kitchen · Pack: a `packed` flag and per-item ticks saved on the server with the order; packing never changes status; "Packed" tag in Pickup & delivery. |
| D-068 | Pickup & delivery is about notifying: Ready for pickup (now / in N min) per place; delivery Out → Arriving soon → Delivered per order. |
| D-069 | Q1 keep D-059 · Q2 live-menu edits are **instant** (Done button, no staged "Publish changes") · Q3 sending "Ready for pickup" to a place **also marks those orders Ready** · Q4 customer taps "I've collected it", seller also has a quiet **Mark collected** in order detail, open orders close when the menu finishes · Q5 menu finishes **automatically at midnight after its cooking day**, plus **Finish menu now** · Q6 build the live **Dishes panel**, **New order on tablet** (slide-over, phone form's fields) and the **Sumatra** danger shift · Q7 web push is plan 002. |

## Stages

Do them in order: later stages build on earlier ones. Each ends with `pnpm typecheck` passing.

| # | stage | where (main files) | done when |
|---|---|---|---|
| 1 | **Theme and fonts** | copy `uxDesign/seller/theme/tokens.ts` into `src/theme/`; `ThemeProvider` at the app root; Plus Jakarta Sans + IBM Plex Mono (Google Fonts link in `index.html`) | `makeColors(brand, mode)` drives every colour; mode (light/dark/auto) per device; brand defaults to Onde Onde until stage 3 stores it; `color-scheme` set on the root; Sumatra shifts danger toward orange-red; old Sogan tokens removed |
| 2 | **Shell and patterns** | `src/app/SellerLayout.tsx`, `src/app/layout.ts`, `src/app/railPreference.ts`, a new `src/ui/patterns/` (or extend `src/ui/`) | left panel 232 / 72 px with menu picture or small icon, nav (chefs: no Menu, no Settings), "Not published" badge on Menu, Switch / EN-ID / Collapse at the bottom; banner 5:1 that shrinks to a strip on task screens; phone (< ~600 px) bottom bar Orders · Pickup & delivery · More and an "Open this on a tablet or computer" page; the patterns from handoff → Patterns built once: list + side panel (384 px), slide-over (560 px), warning dialog, toast with Undo (6 s), bottom sheet, empty state, pager of 20, compose & send |
| 2b | **Design-compare check (simple)** | `src/harness/` (the existing `?harness=<name>&screen=…` pages with MSW fixtures), a new `e2e/design-compare.spec.ts`, `captures/design/` (ignored) | one command, `pnpm e2e e2e/design-compare.spec.ts`, opens each redesigned screen in the harness (dark, Onde Onde, default state; tablet 1180 × 820, phone 390 × 844 for phone screens), screenshots it and writes `captures/design/index.html` with **the app beside the matching `<Board>__default.jpg`**; later stages add their screens; run at checkpoints (not part of the typecheck-only loop) |
| 3 | **Server: menus and dishes** | `migrations/` (new migration), `shared/domain.ts`, `shared/menuContract.ts`, `shared/setupContract.ts`, `shared/limits.ts`, `shared/backup.ts`, `worker/db/` (`seller.ts`, `write.ts`, `rows.ts`, `seed.ts`, `sampleData.ts`), `worker/api/routes.ts`, `worker/repo/Repository.ts`, `mocks/` | records from handoff → Data model: **Menu** (state not published / live / finished, cooking day, cut-off, pickup place ids + per-menu time overrides, delivery on + note, picture, wizard step reached, taking orders on/off) · **Dish library** (Your dishes) · **Menu dish** (dish id + price, limit, chef, sold out per menu) · **Saved set** = list of dish ids · **Pickup place** (max 5) · kitchen **theme** and **menu defaults** · chef default = the whole kitchen; auto-finish at midnight after the cooking day (the Worker's scheduled job) and a "finish now" call; finishing closes still-open orders; seed data updated |
| 4 | **Server: orders, packing, messages** | same folders as stage 3 | order gets `packed`, per-item ticks, collected time and who collected (customer or seller); **message log** (menu, group = place / delivery / order, type, time, sent count); "message a pickup place" API (Ready in N min / Ready for pickup / own text; Ready for pickup also sets those orders Ready); delivery step API (each step notifies the customer's order page); customer "I've collected it" API; every refusal that used to block now returns a warning the client can override (D-062) |
| 5 | **Sign in** | `src/features/seller-auth/` | board `Signin`, all steps (sign in, password, first time with invite key / 6-digit code, create), tablet and phone layouts, inline errors |
| 6 | **Orders (home)** | `src/features/seller-orders/`, `src/app/AppRoutes.tsx` | the four home states (first-run checklist, not published, live, cooking day over); list rows, status tabs + Changed / Not paid toggles; Taking orders switch; order detail with Confirm, Send WhatsApp link, Mark paid, Lock, Nudge, Cancel (warning), **Mark collected** (quiet); toasts with Undo; **New order** as a slide-over on tablet; **live Dishes panel** (sold / limit / left, edit limit, sold out) |
| 7 | **Menu** | `src/features/seller-menu/`, `src/features/seller-setup/` (menu settings move into the wizard), `src/features/seller-share/` | Menu screen in its three states with Past menus (pages of 20, detail panel, "Use these dishes for a new menu"); **Make a menu** wizard: Dishes (reuse picker: Your dishes, Saved sets, Past menus; new dish; save as set; max 10) → Details (cooking day, orders close, delivery, pickup places ticked / edited in place, menu picture 3:2) → Check ("Worth a look" warnings, phone preview EN/ID) → Publish & share; autosave, plain Close; editing a live menu: tabs Dishes · Details · Prices & limits, instant, Done; **Dish editor** slide-over with Edit chefs; Finish menu now |
| 8 | **Kitchen** | `src/features/seller-cook/`, `src/features/seller-labels/` | Cook (rows, totals, pickup/delivery split, group by dish or chef, count mode "6/11", Print labels A4 / 62 mm) and Pack (bag list sortable by time / place / code, one bag at a time, tick rows, "Packed · next bag" with warning, Skip for now, "N of M bags packed") |
| 9 | **Pickup & delivery** | `src/features/seller-saturday/` (rename the folder to `seller-handover/` if you like) | Pickup: one column per place (header with time, directions, counts, last message sent, Message button; rows with code, name, paid, items, status, Packed tag; no per-row buttons); Message dialog (Ready in N min / Ready for pickup / own text, preview, sent marks, repeat warns); Delivery: per order Out for delivery → Arriving soon → Delivered; search by bag code or name |
| 10 | **Settings** | `src/features/seller-settings/`, `src/features/seller-setup/` (Pictures, Chefs), `src/features/seller-history/` (Backup), Devices | panes: Kitchen (name, WhatsApp number, pictures in the new sizes, picture description EN/ID) · WhatsApp post · Pickup locations (max 5, add / edit / delete with warning) · Menu defaults · Appearance (mode, theme) · Chefs · Devices (pages of 20) · Backup (includes the new records) |
| 11 | **Phone views and contacts** | the screens above at phone width; a device-only contacts store (IndexedDB or localStorage) under `src/features/seller-orders/` | Phone-Orders (banner 3:1, WhatsApp button per row), Phone-Order ("Confirm & send on WhatsApp"), Phone-NewOrder, Phone-Handover, Phone-More; **phone number and delivery address fields** on the phone order screens, saved on this phone only, opening that customer's chat when set; export / import contacts in More |
| 12 | **Customer pages: just what's needed** | `src/features/customer-menu/`, `src/features/customer-orders/`, `src/app/CustomerShell.tsx` | the seller's theme applied; menu picture at the top of the menu; pickup place choice at checkout (with its time); "I've collected it" on the order page; no "Saturday" / "this week" wording; plain styling (the customer redesign is a later plan) |

## End of phase

- [ ] Full gate: `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test` · the Playwright specs of changed screens (`pnpm e2e <spec>`)
- [ ] The owner tries it on the tablet, a phone and the PC

## Notes

### Progress

- Stage 1 (theme and fonts): started 01:25 (builder · sonnet). Coordinator decision: the old `theme.colour.*` / `theme.status.*` keys stay as aliases derived from `makeColors` until each screen is redone; every Sogan hex is removed.
  - ✅ landed ~01:27, typecheck clean: `src/theme/designTokens.ts` copied; theme = `{ c, font, size, mode }` plus deprecated aliases; Sumatra danger #FF8A5C (dark) / #B33A0C (light), ≥ 5.2:1; fonts linked in `index.html`; scrim kept as a literal rgba (no design token). Risk: the new contrast tests are unrun (D-055), so the status pairs are checked at the end.
- Stage 2 (shell and patterns): started 01:27 (builder · sonnet). The design reference screenshots are being generated alongside.
  - ✅ landed ~01:33, typecheck clean:
    - nav Orders · Kitchen · Pickup & delivery · Menu · Settings (ID Pesanan · Dapur · Serah terima · Menu · Pengaturan), mapped to today's routes; Settings = today's More hub until stage 10; chefs see no Menu or Settings;
    - "Not published" badge on Menu;
    - phone (< 600 px): bar Orders · Pickup & delivery · More, plus an "Open this on a tablet or computer" page; the desktop switch moved from 1024 to 600 px;
    - task screens (Kitchen, Pickup & delivery, Menu, Settings) get a banner strip;
    - patterns in `src/ui/patterns/` and `?harness=patterns`.
    Deviations: the orders table now shows from 600 px and is cramped at 600–1024 with the panel open (stage 6); `SwitchPerson` and the kit buttons still use the old colour aliases. The builder used one heredoc (a non-python, throwaway script); no stray process was found.
- Stage 2b (design-compare): started 01:34 (builder · sonnet). Design references: 157 shots generated (finished before 01:33).
  - ✅ landed ~01:35. `pnpm exec playwright test e2e/design-compare.spec.ts --project=desktop-chromium --no-deps` → `captures/design/index.html` (3 entries, 0 console errors). The dev-picker mode is used, not a real sign-in.
- **Checkpoint 1 (after stage 2), 01:36:** the coordinator compared Main and Phone-Orders with the design. The shell matches: rail width, nav items and icons, dark Onde colours, banner, bottom bar. Content is still the old screens (stages 6 and 11). Small gaps left for later stages: nav count on Orders (stage 6); the rail picture card (rounded, padded); the phone bar's active pill; the old 2:1 phone banner letterboxed (the new 3:1 slot comes in stage 10). Nothing clearly off, so nothing was fixed.
- Stage 3 (server: menus and dishes): started 01:40 (builder · sonnet). Coordinator decision: today's endpoints keep their response shapes (legacy adapters) until stages 6–10 replace the screens, so the app stays usable between stages.
  - ✅ landed ~02:01, typecheck clean (coordinator re-checked at 02:02):
    - migration 0003 (`menus` replaces `weeks`; `dishes`, `pickup_places` (max 5), `menu_pickup_places`, `saved_set_dishes`; kitchen theme and menu defaults);
    - new `/api/seller/menus|dishes|saved-sets|pickup-places|preferences` routes;
    - legacy endpoints adapted until stage 7;
    - hourly auto-finish cron (max 12 menus a run); finishing closes open orders.
    A scratch-DB smoke passed 19 of 19.
- Stage 4 (server: orders, packing, messages): started 02:03 (builder · sonnet). Migration 0004 is planned; legacy hand-over shapes stay until stage 9.
  - ✅ landed ~02:16, typecheck clean (coordinator re-checked at 02:17):
    - migration 0004: `orders.packed`, `collected_at`, `collected_by` and `pickup_place_id`; `order_lines.ticked`; `message_log`;
    - routes: pack, messages per place (`ready_now` sets Ready, `ready_in`/custom don't), delivery steps, seller and customer "collected";
    - D-059 guard rejects phone and address keys;
    - warn-not-block = 409 with a `warning` body that `force: true` overrides (builder's choice, accepted);
    - a seller-entered order over the limit can be forced.
    Smoke: 23/23 plus saturday 9/9 under a shim.
- **Checkpoint 2 (after stage 4), 02:17:** stages 3–4 are server-only, so the design-compare check is unchanged since checkpoint 1 and was not re-run. The builder's local DB was rebuilt at 02:09 with the final 0004 (written 02:07), so no second reset is needed; old DB backed up to `scratch/checkpoints/wrangler-state-before-reset.tar`.
- Builder: "A" (continue to stages 5–7). Stages 5 (sign in) and 6 (Orders home) run as a wave of 2 (disjoint folders; each runs typecheck only and reports, not fixes, errors in the other's files); stage 7 follows. Started 02:36.
  - Stage 5 ✅ landed ~02:45:
    - steps: sign in (one face/fingerprint button), password, first time (key / 6 boxes), create (two cards);
    - inline errors; the kitchen logo and name above the form;
    - all passkey, switch and lockout behaviour kept.
    Typecheck: clean in its files; the only error at landing was in stage 6's `OrderDetailScreen.tsx` (in progress).
    Deviations: the per-device passkey how-to tabs are gone (not on the board); no username field (the API takes slug, password and chef).
    **To fix at the end gate:** e2e `seller-auth`, `session-flow` and `admin` specs and `admin.test.tsx` look for the old labels ("Sign in with passkey", "Create passkey", "Enter the key you were sent"); the `src/harness/seller-auth.tsx` screens are stale.
  - Stage 6 ✅ landed ~02:49, typecheck clean (coordinator re-checked at 02:50):
    - four home states from `menus/current` (first run = not published with no dishes, orders or history: the builder's inference);
    - live list with search, Changed / Not paid toggles and status tabs; Taking orders switch;
    - detail panel with Confirm, Send WhatsApp link, Mark paid, Lock, Nudge, Cancel and a quiet Mark collected;
    - Undo on confirm, paid and cancel; 409 warnings → WarningDialog → force;
    - New order slide-over (no phone or address);
    - Dishes panel via today's `PATCH /menu/items/:id`; Orders count in the nav.
    Deviations: icons stand in for "person" (none exists); "Create only" sits in the form body (SlideOverEditor has one footer action); no Send reminder; Earlier menus link to past weeks. The builder used heredocs about 6 times (node, not python; no stray processes) and briefly ran `git rm --cached` (index restored, checked). **To fix at the end gate:** `sellerScreens.test.tsx`, `batch2.test.tsx`, and the e2e specs on the old table and slide-over.
- Stage 7 (Menu, wizard, dish editor): started 02:51 (builder · sonnet). It also adds the menu-picture upload route, turns empty-menu publish into a warning (D-062), adds the SlideOverEditor second action and the person icon for stage 6, and retires the menu, week and sets legacy adapters.
  - ✅ landed ~03:12, typecheck clean (coordinator re-checked at 03:13). Menu screen (none / not published / live, plus the past-menus panel); wizard `/seller/menu/make/:step` with autosave; live edit tabs `/seller/menu/edit/:step`, instant; dish editor (`?dish=`); Your dishes and Saved sets screens.
    New server routes: menu picture PUT/DELETE (R2, 1200×800), unpublish, delete a not-published menu; empty publish → warning `no_dishes` + force.
    Legacy `/week*`, `/sets*`, item add/delete/reorder removed (kept: `GET /menu`, `PATCH /menu/items/:id`, past weeks, public menu).
    Deviations:
      - a deleted not-published menu ends as finished, so Orders home may show "Just finished" for it (fix in a later stage);
      - past-menu dishes are matched to the library by name;
      - saved sets have no rename or delete;
      - the paste-post screen and the customer preview route are retired (the Check step's preview replaces them).
    **To fix at the end gate (many):** mocks `setup`, `archivedOrders`, `live`, `queries`, `auth` (chef route list), `menus`; src `AppRoutes.test`, `SellerShell.test`, the seller-share tests; e2e `seller-menu`, `seller-setup`, `archived-orders`.
    Process: 3 empty heredocs by reflex, one hung until stopped; no stray processes remained at 03:13.
- **Checkpoint 3 (after stage 7):** design-compare entries for Signin, Main and Menu being added and run (helper · sonnet, 03:14). Results, 03:16: 14 entries loaded, 0 console errors. The coordinator compared Signin, Main, Menu-Home, the live edit Prices tab and Dish-Edit with the design.
  - Close to the board: the sign-in layout and steps; the Orders header (Live, Taking orders, Share menu, New order, sub-line, search, toggles, tabs); the Menu-Home live table; the live edit tabs with Done; the dish editor EN/ID side by side.
  - Clearly off, fixed now: the Menu header links render as browser-blue links; the dish editor has no title.
  - Not reachable, skipped: Main-Empty and Main-Finished (no dev route); the wizard Check step (the sample menu is live, so the harness shows the live edit).
  - Data note: the sample data has no orders, so the list is empty.
  - Fixed (~03:18): Menu header links styled as quiet accent links; the dish editor has a visible title.
- Builder: "A" (continue to stages 8–12). Stages 8 (Kitchen), 9 (Pickup & delivery) and 10 (Settings) run as a wave of 3, started 03:20. Disjoint folders; new client calls go in separate `src/api/*.ts` files; only stage 10 edits `AppRoutes.tsx`.
  - Stage 8 ✅ landed ~03:25:
    - Kitchen shell with Cook and Pack tabs (`?tab=pack`);
    - Cook: by dish or chef, count mode made/total saved on the device, Print labels links to `/seller/labels`;
    - Pack: bag list (sort by time, place, code), one bag at a time, tick rows saved to the server, "Packed · next bag" with warning → force, Skip for now, the all-in hint.
    Its own files typecheck; the remaining errors were in stage 9's in-progress files.
    Deviations: Cook stats, the "Confirmed only" mode and the extra groupings were dropped (not on the board); an extra "Mark not packed" button; delivery bags show no time.
  - Stage 9 ✅ landed ~03:26, typecheck clean:
    - Pickup & delivery screen with a Pickup · N / Delivery · N switch and search;
    - Pickup: one column per place, header with time, directions, counts, last message, Message N; rows with code, name, paid, items, status, Packed;
    - Message dialog: ready in N, ready now (says it also marks Ready), own text; preview EN/ID; warning → force;
    - Delivery: 3 step buttons per order with the current step marked, warning → force.
    Legacy removed: `arriving-soon` route and repo. Kept: `/updates` (its contract constants are reused), nudge, seen.
    **Owed to stage 11** (AppRoutes was stage 10's in this wave): route `/seller/hand-over` to the new screen, drop the old hub, the `hand-over/pickup|delivery` routes and `/seller/updates`, delete `SendUpdateScreen.tsx` (now aliases), the dead `sendArrivingSoon` in `client.ts` and its test, and `scratch/_head.txt`. The builder was denied `rm`.
  - Stage 10 ✅ landed ~03:28, typecheck clean (coordinator re-checked):
    - Settings panes at `/seller/settings/:pane`: kitchen, post, pickup (max 5), defaults, look (mode per device, 5 themes per kitchen, recolours at once through `kitchenBrand.ts`), chefs, devices (pages of 20), backup;
    - old routes redirect to the panes;
    - new picture sizes: wide 2000×400, phone 1200×400, icon 512, kitchen menu picture 1200×600.
    Deviations: kitchen name read-only (no route); static pane subtitles; pickup delete warns after the fact.
    **Owed to stage 11:** delete the old `SettingsScreen` and its test; a server route to edit the kitchen name (the handoff lists the name as editable).
- Stages 11 (phone views, contacts, cleanup) and 12 (customer pages, minimal) run as a wave of 2, started 03:29. Stage 11 owns `AppRoutes.tsx` and `client.ts`; stage 12 owns the customer features, `CustomerShell` and the public menu/order server parts. File deletions are listed for the owner, not done by builders (their `rm` is denied).
  - Stage 12 ✅ landed ~03:34, typecheck clean:
    - customer pages set the kitchen brand from the public menu's `theme`;
    - menu picture 3:2 shown whole;
    - pickup place radio choice at checkout when there is more than one place (place shown on the order and placed pages);
    - "I've collected it" on Ready pickup orders (tap twice);
    - "this week" / "Saturday" wording replaced with the cooking date.
    Contract: public `MenuResponse` gains optional `theme` and `pictureUrl`; `CustomerOrder` gains `pickupPlaceId` and `collectedAt`. New `shared/themes.ts` (avoids an import cycle).
  - Stage 11 ✅ landed ~03:43, typecheck clean:
    - phone Orders list (dropdown and sheet filter, WhatsApp per row), order detail ("Confirm & send on WhatsApp"), New order with phone and address saved **on this phone only** (localStorage `sellerContacts.v1`, AU-normalised, pruned after 60 days, export/import JSON, never sent);
    - phone Pickup & delivery (one place at a time); phone More (switch, language, sign out, contacts);
    - `/seller/hand-over` → new screen, old routes redirect; `sendArrivingSoon` removed;
    - kitchen name editable (`PUT /api/seller/kitchen/name`, 1–60, chefs 403);
    - a deleted not-published menu now shows first-run / no menu.
    The builder used heredocs for a few new files (no stray processes found).
    Files left unused but still referenced by harnesses or old tests: `SendUpdateScreen.tsx`, `seller-settings/SettingsScreen.tsx` (+ test), `seller-orders/OrdersScreen.tsx` and `OrderRow.tsx`, `scratch/_head.txt`.
- **End of phase: full gate started 03:44.** First run (`scratch/gate-plan001-1.log`): typecheck ✅, format ✅, **lint 203 errors** (mostly `no-unsafe-*` and literal px), **unit 90 of 1298 failing in 14 files** (old routes and screens). Fix wave of 3 started ~03:49: A (menu, settings, setup, auth, customer, ui, api, shared), B (orders, cook, hand-over, app), C (mocks and worker). E2E comes after the unit gate is green.
  - Fix wave results:
    - A: lint 34 → 0, 682 tests pass; cross-feature imports replaced by slots/props, `imageResize` moved to `src/components`;
    - B: lint 47 → 0, 241 tests; **real bug fixed:** New order showed "N left" for every limited dish instead of only at 5 or fewer;
    - C: lint 120 → 0, 332 server tests; a file-level `no-unsafe-*` disable in `mocks/menus.test.ts` (loose JSON); no server bugs.
    A stray `python3 -` from fixer B spun from 03:55 until the coordinator stopped it at 04:20 (lesson 17).
  - Second run, 04:15–04:20: typecheck ✅, format ✅, **unit 1297/1297 ✅**, lint: 2 errors left (floating promises in `src/ui/patterns/patterns.test.tsx`). E2E measuring run started 04:21.
  - E2E measuring run 04:21–04:28: limits 1 ✅; failures auth-mobile 2, auth-desktop 2, session-flow 1, archived 1, settings 3, desktop 10 (13 pass), mobile 6 (9 pass), in 16 spec files: old screens, labels and routes. Fixer D (sonnet) started 04:28. It works alone, because e2e uses a fixed port and DB.
  - Fixer D: 26 → 0 failures.
    - **Real bugs fixed:** the Settings Kitchen Save did nothing before the name loaded; closing a live socket that was still connecting logged a console error.
    - Spec cuts where the subject was removed: typed-code collect, dish reorder, paste-post, the customer preview, the cook chips. Tablet-only screens are tested at 600 px and up only.
    - Process: 2 heredocs, and a `node -e` hung on stdin (stopped).
  - **✅ Final gate 05:17–05:23 (coordinator, quiet tree, 0 CRLF):**
    - typecheck ✅ · lint ✅ · format ✅ · unit **1297/1297**;
    - e2e one project at a time: auth-mobile 4 (+1 skip), auth-desktop 5, session-flow 1, limits 1, archived 1, settings-desktop 4, desktop 23 (+3 skip), mobile 10 (+16 skip);
    - not run: the webkit projects;
    - snapshot `plan001-done.tar`.
  - **Open for the owner:**
    - files left unused: `SendUpdateScreen.tsx`, the old `SettingsScreen` + test, and the old phone `OrdersScreen`/`OrderRow` (still used by older tests);
    - confirm the KEEP guide values on the Pictures screen (1500×350, 1000×340);
    - the plan's "Owner tries it on the tablet, a phone and the PC" box.
    **To fix at the end gate:** the seeded saved set breaks set-count expectations in `src/api/setup.client.test.ts`, `seller-menu/savedSets.test.tsx` and maybe `e2e/seller-menu.spec.ts`.
    **Open against D-062:** publishing an empty menu is still refused (`no_items`), so stage 7 should make it a warning.
    **The builder's local DB must be rebuilt:** delete `.wrangler/state`, then migrate and seed (the admin passkey and sellers set up locally are lost).

- **Design references for the compare harness:** `uxDesign/seller/captures/<Board>__<state>.jpg` (157 shots: every board in every state and theme) are the references. They are **not in git** (17 MB): run `node uxDesign/seller/capture.mjs` once on a new PC to make them; it also re-shoots them (`node capture.mjs`, or `--serve` to browse the live boards at http://localhost:4173). Stage 2b pairs each app capture with the matching `<Board>__<state>` file.
- **Picture sizes change** (handoff → Picture slots): phone banner becomes 3:1, wide banner 2000 × 400, small icon 512 × 512, menu picture (kitchen) 1200 × 600, plus the new per-menu picture 3:2. Old uploads may show letterboxed; that's fine.
- **Later, not in this plan:** web push (plan 002, must be done before going live), the customer app redesign, per-dish pictures.
