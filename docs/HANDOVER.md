# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here. Older hand-overs are in git history.

**Last session:** 2026-10-18 → 20 Oct, the owner's PC (Adelaide), Claude as coordinator. Shipped **1.0.42**, hotfixes **1.0.42.1** / **1.0.42.2**, and **1.0.43** (plans 111, 112, 117 + new seller icon).
**Live:** Release **1.0.43** (20 Oct ~21:53; Worker `63be2500-0346-4234-811f-f91e99901c8e`; health OK, site reports `1.0.115 · 4fcbc1d`; tag `v1.0.43`; migrations 0031 + 0032 applied to the live D1). Backup before it: `backups/shaggybobo-2026-10-20.sql` (897 rows). Before: 1.0.42.2 (Worker `922844c3…`, tag `v1.0.42.2`), 1.0.42.1 (`0170fa3c…`), 1.0.42 (`21340f7c…`).

## House rules (binding)
- **No git writes (commit, push, merge, tag) unless the owner says so for that step; ask first every time.** Stage only your own files, by path; never `git commit -a` while a builder edits the tree.
- **Owner decides; one question at a time** (A/B/C with a recommendation), status marker on every message (🔴 / 🟡 / 🟢), plain words.
- **Mock-up before any UI build;** open mock-ups in the owner's browser (`Start-Process <url>`; viewer `python -m http.server 8765 --bind 127.0.0.1`, use the **127.0.0.1** address).
- **AUD and Adelaide only** in mock-ups and samples.
- **Real clock times only** in `docs/plans/live-status.md` and to the owner (read the clock with `Get-Date`; this session first gave guessed times and had to correct them).
- **Gate scope for small changes** (owner, 17 Oct: "run also only selected test if needed"): typecheck + lint/format on changed files + the unit tests of the touched areas + the e2e specs of every touched screen; the full suite only when the owner asks.
- Files under ~750 lines (soft); don't grow routes.ts, seller.ts, menus.ts, auth.ts, AppRoutes.tsx.
- Agents never deploy, never run `--remote` / `wrangler secret`, never reseed; back up before migrations.

## 1.0.39 (plan 092, D-108): what's in it
Source: the owner's first real-phone use of Remember me (iPhone home-screen app, passkey saved in Keeper → no address lock; after switching to Apple Passwords the lock worked).
1. First name asked before the passkey prompt, with Skip.
2. "We keep your address so it's filled in for you next time."
3. No app lock (Face ID only for the saved address).
4. Remember me card calmer (one Turn on, quiet links; on-state as a tidy list).
5. Privacy note with headings + bullets.
6. "lock/locked" instead of "seal/sealed" (ID "dikunci/terkunci"); intro "We remember your orders, name and address on this phone and on any other phone you use."
7. Hint: choose Passwords (iPhone) or Google Password Manager (Android); other password apps can't lock the address.
8. Passkey names by role: "<name> · customer (Remember me)", "<name> · seller", "<name> · admin"; no name: "Remember me · ShaggyBobo's Order" etc. Only new passkeys.
9. Every bottom sheet slides up (none with Reduce Motion).
10. Customer Settings: value rows ("Appearance  Dark ›") open a choice sheet (option D of `uxDesign/customer/mockups/092-settings-align.html`).
Release notes: "Small fixes and polish." / "Perbaikan kecil dan penyempurnaan." (owner "B").
**Gate (scoped, 17 Oct 23:06):** typecheck, lint, format ✅; unit 105/105; e2e 14/14 over p087-remember-me, customer-batch1/2, native-customer, pickup-map, p083-change-fulfilment, seller-saturday, seller-list-scroll (mobile-chromium + iphone-chromium). Captures at 390 px checked.
**Deploy impact 1.0.39:** no migration, no new secret; client + worker labels only. Existing passkeys keep their old names. Low risk. Deploy order: `pnpm build` → `pnpm exec wrangler deploy` → live check (Settings rows + sheets, Remember me turn-on with first name on a real iPhone, privacy note) → merge `main` + tag `v1.0.39` (ask first).

## 1.0.40 (plan 093): banner doesn't flash
Owner, 17 Oct: "changing page make the image banner on top flashing and kept reloading" (older bug, since `key={pathname}` on the page slide, 10 Oct). Fix: the banner is drawn once in `CustomerShell` (`src/app/ShellBanner.tsx`) above the sliding page; pages' own `KitchenBanner` renders nothing inside the shell (context `ShellOwnsBanner`), still renders in seller preview; the last loaded banner stays while the same kitchen reloads; the skeleton is now banner-sized (3:1). Release note reuses "Small fixes and polish." **Gate (scoped, 23:31):** typecheck, lint, format ✅; unit 370 + 99; e2e customer-batch1/2, native-customer, p087, pickup-map 12/12; capture: banner stays across My orders ↔ Settings. **Deploy impact:** client only, no migration, no secret. Live check: switch Menu ↔ My orders ↔ Settings on the iPhone; the banner must not flash.

## 1.0.41: banner everywhere, sheets, notice pills, nudges, root page
Release note (owner "B"): "A fresher look for customers and clearer messages." / "Tampilan pelanggan lebih segar dan pesan lebih jelas."
- **094** one big kitchen banner on every customer page (shell, never remounted; small logo bar gone; closed-menu picture below the banner); seller tablet/phone banners stay mounted; bottom sheets lock the page behind (iOS-safe) and **swipe down to close**; stale `AppRoutes.test` from 092 fixed.
- **095** notice pills (option E2, `uxDesign/seller/mockups/095-notice-bars.html`): floating 40 px pills with the ShaggyBobo icon; new version = green, tap anywhere to refresh, ✕ only hides; announcement/maintenance = amber (`src/components/notice/NoticePill.tsx`, tokens `notice.*`). Admin's short-message *preview* still shows the old bubble (follow-up).
- **096** nudges (`uxDesign/customer/mockups/096-install-nudge.html`): first visit no nudge (menu chip removed); name step "☐ Remember me on all my phones (?)" with an info sheet (tick → turn-on sheet after placing, one tap "Continue"); after the first order "Add to your home screen · How" (stone N1 pill, browser only, ✕ 14 days); Remember me pill after first/delivery order (30 days, max 3, one nudge at a time); empty My orders "Turned on Remember me before? Restore your orders".
- **Root page "/"** (option B of `uxDesign/customer/mockups/097-main-page.html`): standalone page, About hero animation, logo, "Welcome to ShaggyBobo", "Looking for something here? Open the link from the person or group who invited you."; no tab bar, no jump in a browser; inside an installed app it jumps to the last kitchen; `noindex`; neutral link preview "ShaggyBobo · By invitation"; kitchen-not-found clears the saved kitchen (no loop).
**Gate (scoped, 18 Oct):** typecheck, lint, format ✅; **all** unit tests 1905/1905; e2e customer 11 specs ✅ (p087 fixed: spec opened Settings before any kitchen was remembered), seller 5 specs 7/7, short-message + maintenance 2/2. Captures checked: closed menu, dishes, My orders, order page, root page.
**Deploy impact 1.0.41:** client + one head-tag/meta change; no migration, no secret. Installed home-screen apps still start at their kitchen (manifest start_url unchanged). Live check on the iPhone: banner on every page incl. dishes/order, swipe a sheet down, privacy sheet doesn't scroll the page, the green "new version" pill appears after deploy (tap it), send one short message (amber pill), a first test order shows the home-screen pill, the name-step tick, "/" in Safari shows the welcome page.

## 1.0.42 live (19 Oct)
Committed 18 Oct afternoon: **stages 0–2** (no behaviour change, no migration).
- **0** docs: `docs/architecture/data-model.md` "One model, many kinds", **D-109**, 082 note, 088/090 merged into 098.
- **1a** `worker/api/routes.ts` 1,709 → 89 (dispatcher) + 13 area files; 82 seller routes carry `roles` (allow-list; `chefMayNot`/`helperMay` gone). `mocks/roleMatrix.test.ts` (129 probes × 7 callers) identical before/after, except chef/helper get 403 (was 404) on seller paths with no route. **6 suspicious chef permissions reported, kept as today** (delete-address, all order edits, translate/updates/demo, settings reads, cancel a normal order, private reads rely on handlers): ask the owner one at a time.
- **1b** `worker/db/{seller,menus,auth}.ts` → 21 files by group, move-only, import paths unchanged.
- **2** `AppRoutes.tsx` 997 → 30 + customer/seller/admin/More route files; `src/ui/Notice.tsx` (2 sites converted; SellerLayout had 1 notice, not 3); `orderRowCells.tsx` (only `NewTag` is truly shared); Help topics/Help/Install/OrdersTable/CheckoutViews split (all < 500), kit buttons kept where looks differ; **Cook/Pack read the Orders slice** (one counted live loop, `src/api/kitchenOrders.ts` contract, saga tests moved to `src/app/`).
- **Q3 changed to C** (owner, 18 Oct): checkout stays in `customer-menu` until the store (one shared customer slice/saga/parts; the move needs a neutral shared core first). Only the in-place split (`CheckoutForms.tsx`).
- Stale specs fixed: `mocks/rememberMe.test.ts` (1.0.41 passkey label), `e2e/p089-order-limit.spec.ts` (Language is a sheet since 1.0.39).
- **Gate (18 Oct ~15:40):** typecheck, lint, format ✅; unit **2,528/2,528**; mocks+shared 928; e2e touched screens 76 ✅ + 4 re-run alone ✅ (load flakes: Windows port exhaustion → run `mocks` with `--no-file-parallelism`, one Playwright run at a time).
- **All of 1.0.42 built (18→19 Oct, uncommitted after 572a5df):** 100 compact Cook (B2); 103 fixes 1–8 (echo skip, fewer reloads, chef edit, menu loaded once, optimistic Confirm/Paid, Paid / Not paid sheet, menu edit session); 104 (Orders "Active", print "Which orders", rail Home · Menu · Orders · Private · Kitchen · Pickup & delivery · Dishes · Settings · Help · About, delivery rows + All/Delivery/Pickup filter, admin short-message preview, scroll fixes, customer address map buttons visible, small maps view-only); **105** seller edits any order (`PATCH /api/seller/orders/:code`, D-110); **106** link window A + Customers list (A–Z, device-only phone/address); **107** On the day (Menu tabs Pre-orders | On the day, Sell as per dish, Home line, customer one list "On the day only · at the stall"); **108** compact Home/Menu/Orders, order panel raised as a card; **109** kitchen print (per dish, per chef pages option, private orders option, notes); **098 stage 3** (C10 expired-code sweep, C12 live tokens in `Sec-WebSocket-Protocol` with `?tokens=` fallback). Release note "A" in `releaseNotes.ts`, `RELEASE_VERSION = '1.0.42'`.
- **Gate 2 (18 Oct 22:07 → 19 Oct):** typecheck, lint, format ✅; unit **2,594/2,594** ✅; e2e 96 passed, 1 failed (helper-flow: test mistook the device's Customer details "Backup" button for the hidden Backup screen; test fixed, re-run).
- **Deploy order (owner rule):** backup → `pnpm build` → migration (if any) → `pnpm run deploy` (Worker + app together; C12 keeps the `?tokens=` fallback) → health check → live checks. 1.0.42: no migration, no secret.
- **Live checks 1.0.42:** seller Orders (Active tab, edit an order, Paid sheet), Edit menu → Save, Menu tabs + Sell as + Home "On the day" line, kitchen print, Customers list, a chef and a helper sign-in, customer order end to end incl. On the day group and address map on the iPhone, customer live updates (C12).
- **Phone numbers (20 Oct, owner):** accepted rule stays as D-111 (C: a 0 typed after the country code is not fixed); no specific error messages ("not worth it"), Help explains instead.
- **Build time (analysis only):** `tsc -b` re-checks everything every run (~30 s; `noEmit` without `incremental`, "output file src/main.js does not exist"); `pnpm run deploy` builds again after `pnpm build`. Possible fix `"incremental": true` in the 3 tsconfigs, under plan 091; not done.
- **1.0.43 = 101 + 102 together** (owner's choice; Fable advised splitting routes).
- **Rules from 18 Oct:** ask the next question only after the owner says "go next question"; mock-ups never invent features; button labels never wrap (`docs/design/README.md`).
- **Deploy impact:** medium (size). Server: new edit-order route, live-socket token header (old tabs use the fallback), retention sweep. Client: many seller screens. No migration.

## 1.0.43 live (plans 111, 112, 117, 20 Oct)
- **111 dish choices + line notes (D-112):** a choice is a grouped dish (name EN/ID + limit; price, chef, pre-order/on-the-day from the dish); Sold out per choice; customer bottom sheet; basket pencil + note sheet; Cook/kitchen print/labels/order detail/WhatsApp text/edit order/private orders show choices and notes; backup/restore carries choices. Choices added to a dish apply from the next menu.
- **112 new-menu notices (D-113):** quiet customer Settings option with explanation; seller bell (owner only) on Home + Menu (tablet), Orders header (phone), only while orders are open; sends recorded per menu, 3rd send warns; 500 phones per kitchen; phones dropped 183 days after their last order.
- **Also:** new ShaggyBobo seller app icon (192/512/maskable, `public/brand/`), seller splash stays cream; 2 query savings (plan 113): backup 15 trips, dish list 2; 57-trip menu save fixed (choices loaded once).
- **Migrations:** `0031_dish_choices.sql` (3 add-only columns), `0032_menu_notices.sql` (2 new tables). Run both **before** the Worker deploy (the new routes read the tables).
- **Deploy order:** backup → `pnpm build` → `pnpm exec wrangler d1 migrations apply shaggybobo-order --remote` → `pnpm run deploy` → health check → live checks (dish with choices end to end, line note on Cook/print, bell + Settings option, chef sign-in sees no bell).
- **117 "What's new" pill:** shown once per release per seller device (floating pill, `src/components/whats-new`); See opens About with the releases, newest marked New for 14 days.
- **Release note (owner "A"):** "Dishes with choices, a note on each dish, and send customers a notice when a new menu is out."
- **Live checks 1.0.43:** ✅ all good (owner, 20 Oct evening).
- **Backup summary:** after each backup give the owner the counts (Remember me, passkeys, order notifications, new-menu notices, orders per day per kitchen, order counts per menu; never income), read locally from the backup file (python sqlite3 in memory), never `--remote`.
- **Next: hotfix 1.0.43.1 = plans 114 + 115** (owner 20 Oct "A": "just perf and not too visible"; no version bump, no release note, tag `v1.0.43.1`). **1.0.44** is kept for 101/102, decided later, after Fable's risk review (must not break existing installs or links; DellaVee has live customers). Plan 114 items 1–5; plan 115 needs a mock-up first.

## Hotfix 1.0.43.1 (21 Oct): built and gated, not yet deployed
- **Plan 114 slow networks:** request time limits (10 s reads, **45 s writes**, owner "A"; 60 s backup/CSV; feature-checked); **no double orders**: `clientOrderId` (migration `0033_client_order_id.sql`), fail-open (only a live, uncancelled menu order < 24 h is returned; any problem places the order; malformed id ignored), quiet automatic re-send once after a lost answer, off switch `ORDER_DEDUPE` in `wrangler.jsonc` vars ("on"); Sell −1 / set-count disabled while saving; Taking orders / Sold out disabled while saving + "That did not save" toast; `sw.js` serves the cache after 4.5 s on a slow link (cache v2).
- **Seller "possible repeat" note** (client-only): same device code + same dishes within 2 min → amber note on the later order, "Repeat?" tag on rows.
- **Plan 115 splash:** `index.html` first-paint colours + `public/splash.js` (no inline scripts, CSP-safe, `data-cfasync="false"`), kitchen logo/initials + name (sellers: Bobo + ShaggyBobo), woven texture + soft light, CSS fallback hides it once the app renders.
- **Customer flashes:** dish/hero pictures `loading="eager"` + `decoding="sync"`; no second menu fetch within 30 s on back; forward page moves scroll to the top (D-114, window scrolling kept).
- **Route safety tests** for future 101/102 (`docs/plans/102-route-safety-checklist.md`, 13 pending cases).
- **Gate (21 Oct):** server 1,010 · app 1,751 · full Playwright 120 passed / 0 failed; p114 order-safety 6/6 with the 45 s limit.
- **Deploy:** backup → build → `wrangler d1 migrations apply shaggybobo-order --remote` (0033) → `pnpm run deploy` → health → live checks (order on the iPhone; dark mode in Settings; splash on a cold start; swipe back from Dishes and Basket; seller Taking orders switch; browser console has no CSP errors). Tag `v1.0.43.1`.
- **Lessons 32–38** added (CSP testing, index.html styles, repeat failures, full-suite runs, fail-open, timing tests, shell `&`).
- **1.0.44:** plans 101 + 102 (decide after `docs/reports/2026-10-20-101-102-risk.html`).

## Next session (fresh)
1. Read this file, then CLAUDE.md and `docs/guide/agent-working-conventions.md`.
2. Ask the owner whether setup is needed (same PC: usually not; other PC: `git pull`; `pnpm install`; `pnpm db:migrate:local`, never reseed).
3. 1.0.41 iPhone checks: **done, all good** (owner, 18 Oct). Still open: 1.0.38 pickup map + QR scan, a short message, About animation; a real label print from the Samsung tablet.
4. **1.0.42 live checks:** check 1 (Orders: Active tab, raised card, Paid sheet) ✅ owner 19 Oct. Still open: edit an order, Edit menu → Save, Menu tabs + Sell as + Home "On the day" line, kitchen print, Customers list, a chef and a helper sign-in, a customer order end to end incl. On the day group and the iPhone address map. Then **1.0.43** (plans 101 + 102).
4. Owner checks still open: 1.0.38 pickup map + QR scan (CSP), send one short message, About animation (seller app: More → About), the seller ✓ on a Remember-me order; 1.0.36/1.0.37 phone checks; a real label print from the Samsung tablet.

## Later (owner rulings recorded)
- **Overnight work:** plan **090** clean-up and plan **088** split large files; plan **091** faster tooling (measure first).
- **v1.1.0 (analysis only, own feature branch later):** plan **082** small store ("Sandra's Store"), plan **098** kinds (kitchen/shop/events/community, menu = event, order = ticket), shared seller frame + per-kind UI, plan **099** bigger grocery store / separate deployments. Owner: "we don't have to implement yet … for now it is analysis, maybe for v1.1.0"; "we will then do a feature branch later". Store must keep the no-flash rule (lesson 31).
- Code health report: `docs/reports/2026-10-17-code-health.html`.
- Older open items: Help screenshots from the live app; customer app Lottie round; 077 leftover (Settings "default cut-off time" in the kitchen's clock); Dellavee feedback; the owner's wife's iPad.

## Local tips
- Playwright needs `NODE_EXTRA_CA_CERTS="C:/Users/Indra/AppData/Local/mkcert/rootCA.pem"`. Lint needs `NODE_OPTIONS=--max-old-space-size=8192`.
- After big edits, the running Vite dev server can serve a stale module ("does not provide an export named …"): restart it (only your own PID).
- iPhone: a home-screen app has its own storage, separate from Safari (it starts with no orders/name).
- Passkeys don't work on the LAN-IP dev URL; use `https://localhost:5173`.

## Ready prompt for the next session
> Read docs/HANDOVER.md, CLAUDE.md and docs/guide/agent-working-conventions.md. Live is 1.0.43 (tag v1.0.43). 1.0.43 live checks are done. Next is **hotfix 1.0.43.1 = plans 114 and 115** (owner, 20 Oct; no version bump or release note; 1.0.44 kept for 101/102); plan 115 needs a mock-up for the owner's OK first. 101/102: wait for Fable's risk review (DellaVee has live customers; existing installs and links must keep working or fall back) and the owner's decision. Ask the owner before any git write. Ask me whether setup is needed, then the 6 chef permissions one at a time.
