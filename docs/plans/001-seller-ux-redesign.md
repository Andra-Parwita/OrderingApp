# 001 · Seller app UX redesign

**Status:** approved by the owner (2026-10-10); ready to build
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

- **Design references for the compare harness:** `uxDesign/seller/captures/<Board>__<state>.jpg` (157 shots: every board in every state and theme) are the references. They are **not in git** (17 MB): run `node uxDesign/seller/capture.mjs` once on a new PC to make them; it also re-shoots them (`node capture.mjs`, or `--serve` to browse the live boards at http://localhost:4173). Stage 2b pairs each app capture with the matching `<Board>__<state>` file.
- **Picture sizes change** (handoff → Picture slots): phone banner becomes 3:1, wide banner 2000 × 400, small icon 512 × 512, menu picture (kitchen) 1200 × 600, plus the new per-menu picture 3:2. Old uploads may show letterboxed; that's fine.
- **Later, not in this plan:** web push (plan 002, must be done before going live), the customer app redesign, per-dish pictures.
