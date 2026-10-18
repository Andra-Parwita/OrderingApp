# Plan live status

The plan work in progress, one row per stage or check, kept current by the coordinator (the main AI session) **at every agent start and finish**. Times are real clock times, Adelaide (ACDT). The plan list and each plan's overall status are in [README.md](README.md).

**Columns:** *agent · tier* is the agent type and model (haiku, sonnet, opus, or the coordinator itself). *Est.* is the estimate given at the start. *Took* is the real time from start to end. *± est.* is Took minus Est. (+ is slower than expected). *Diff* is the files and lines changed (`git diff --stat`), or "—" for read-only work. *State:* ⏳ running · ✅ done · ❌ failed · ⏸ waiting.

## Plan 094 one banner everywhere (release 1.0.41)
| stage | agent · tier | started | est. | ended | took | ± est. | diff | state |
|---|---|---|---|---|---|---|---|---|
| 0 · cause search | Explore · sonnet | 18 Oct | 5 min | | 41 s | | — | ✅ |
| 1 · build items 1–5 | general-purpose · sonnet | 18 Oct | 30–45 min | | | | | ⏳ |
| 1b · seller app banner check (owner) | Explore · sonnet | 18 Oct | 5 min | | | | — | ⏳ |

## Plan 093 banner no flash (release 1.0.40)
| stage | agent · tier | started | est. | ended | took | ± est. | diff | state |
|---|---|---|---|---|---|---|---|---|
| 0 · cause search | Explore · sonnet | ~23:13 | 10 min | ~23:14 | 34 s | −9 min | — | ✅ |
| 1 · build items 1–3 | general-purpose · sonnet | 23:17 | 20 min | ~23:27 | 10.3 min | −10 min | 10 files + new ShellBanner.tsx | ✅ unit 370 + 99 |
| 1b · version 1.0.40 | general-purpose · sonnet | ~23:27 | 2 min | ~23:29 | 95 s | ≈ 0 | 8 files | ✅ |
| 2 · scoped gate + captures | coordinator | ~23:29 | 5 min | 23:31 | ~2 min | −3 min | — | ✅ lint, format; e2e 5 specs 12/12; banner stays across My orders ↔ Settings |

## Plan 092 Remember me polish
| stage | agent · tier | started | est. | ended | took | ± est. | diff | state |
|---|---|---|---|---|---|---|---|---|
Correction (22:56, first real clock reading): the start/end times below were the coordinator's guesses, not clock readings; durations come from the agents' own run times.

| stage | agent · tier | started | est. | ended | took | ± est. | diff | state |
|---|---|---|---|---|---|---|---|---|
| 0 · plan + D-108 | coordinator | ~22:25 | — | ~22:30 | ~5 min | — | 3 docs | ✅ |
| 1 · mock-ups (5 frames, EN/ID) | general-purpose · sonnet | ~22:30 | 45 min | ~22:32 | 106 s | −43 min | +1 file, 245 lines | ✅ |
| 1b · item 10 alignment options mock-up + analysis | general-purpose · fable (owner asked) | ~22:35 | 20 min | ~22:44 | 9.3 min | −11 min | +1 file, 198 lines | ✅ |
| 1c · options E icons, F dropdowns, G iPhone slide-in | same agent · fable | ~22:44 | 15 min | ~22:46 | ~15 min total run | ≈ 0 | +53 lines | ✅ owner picked D |
| 2 · build items 1–10 | general-purpose · sonnet | ~22:48 | 1.5–2 h | 22:56 | 7.8 min | −80 to −110 min | 20 files, +493 / −236 | ✅ typecheck clean |
| 2b · fix 5 tests that drove the old Settings radios | general-purpose · sonnet | 22:56 | 10 min | ~22:58 | 77 s | −9 min | 4 files, ~+11 | ✅ unit 31/31 |
| 3 · scoped gate (typecheck, lint, format, unit; then 4 e2e specs) | coordinator | ~22:58 | 8 min | 23:06 | ~8 min (incl. a fix round: 6 unit + 2 lint, then 1 e2e selector) | ≈ 0 | — | ✅ typecheck, lint, format; unit 105/105; e2e 8 specs 14/14 (p087 after selector fix); captures 390 px checked |

## Release 1.0.38: estimate vs actual (owner, 17 Oct: "make sure it has comparisons estimated and actual")
ETA given at 19:06: **ready to deploy ~21:00–22:00**.

| step | estimate | started | ended | actual | ± estimate | note |
|---|---|---|---|---|---|---|
| 1 · Remember me stage 4 (e2e, docs, D-107) | 20–40 min | ~18:28 | 19:08 | ~40 min | at the top of the range | |
| 2a · typecheck | (part of 40 min gate) | 19:10 | 19:10 | 31 s | | |
| 2b · lint | (part of 40 min gate) | 19:10 | 19:13 | 162 s | | needs 8 GB |
| 2c · format | (part of 40 min gate) | 19:13 | 19:13 | 24 s | | after normalising 6 CRLF files |
| 2d · unit tests (1st try) | (part of 40 min gate) | 19:13 | 19:26 | 770 s | wasted | collided with a stray first run (my mistake) |
| 2e · unit + e2e (re-run) | ~23 min (unit ~13, e2e ~10) | 19:26 | 19:44 | 18 min (unit 684 s, e2e 374 s) | −5 min | unit: 6 files (likely flakes, re-checking); **e2e 21 failed**: order placement stuck + seller pages fail fast → suspects: new order limit / CSP |
| 3 · fixes from the gate | 15–45 min (given 19:06) | 19:45 | 21:08 | 83 min | **+38 to +68 min** | real bugs: order limit shared one budget in tests (dev-mode switch + X-Dev-Order-Limit test header), 6-digit code display race, two specs on one admin passkey, a save-on-blur race; new e2e p089 (6th order shows the message); 7 full runs, remaining failures = load flakes |
| 3b · release notes 1.0.38 + version + Help FAQ + docs version label | ~10 min | 20:58 | 21:09 | ~11 min | ≈ 0 | |
| 3c · final lint + format + full e2e (2 workers) | ~15 min | 21:10 | 21:24 | 14 min (lint 143 s, format 16 s, e2e 643 s) | ≈ 0 | **e2e 99 passed, 0 failed**; format: one CRLF-only file normalised |
| 3d · final full unit run | ~12 min | 21:24 | 21:37 | 12.5 min (745 s) | ≈ 0 | 2,427 passed; 3 files port-flaked, 48/48 alone |
| 4 · coordinator look at the screens | ~15 min | 21:25 | 21:33 | ~8 min | −7 min | About 1.0.38, Settings Remember me card, menu; no CSP errors |
| **ready to deploy** | **21:00–22:00** (given 19:06) · 21:30–22:15 (19:45) · 21:50–22:30 (20:57) | | **21:40** | | **inside the first window** | |
| deploy 1.0.38 (owner) | ~15–20 min | 21:41 | 21:45 | ~4 min (build-first order) | −11 min | Worker dc3bc02f |
| CSP follow-up: analytics + nonce, redeploy | — (added after the live check) | 21:50 | 22:15 | ~25 min | | Worker 0708ee42; console clean |
| 3 · fixes from the gate | 15–45 min | | | | | |

## Now

| plan · stage | agent · tier | started | est. | ended | took | ± est. | diff | state |
|---|---|---|---|---|---|---|---|---|
| 1.0.38 · step 1: Remember me stage 4 (e2e, docs, D-107) | builder · sonnet | ~18:40 (17 Oct) | 20–40 min (given 19:06) | 19:08 | ~40 min | ≈ 0 to +20 | e2e p087 (167), docs, D-107 | ✅ e2e 1/1, unit 44 |
| 1.0.38 · step 2: full gate (lint, format, typecheck, unit, full e2e) | coordinator | 19:08 (17 Oct) | 40 min | (rerun) | | | typecheck 31 s · lint 162 s · format 24 s ✅; unit + e2e collided with a stray first run (a backgrounded `&` that kept running) → killed by PID, scratch DBs cleared, unit + e2e re-run 19:30 | ⏳ re-running |
| 081 · delivery row option A (one step row for all, quiet map links, cards, one-line step) | builder · sonnet | ~14:35 (17 Oct) | 30 min | ~14:50 | ~15 min | −15 min | DeliveryRunScreen, parts (cards), QuietMapLinks, shared/address text links, PrivateRow pickups, Private list/detail links | ✅ unit 547, e2e p081 + seller-saturday, typecheck, lint, format, docs; coordinator checked 360/390 px |
| gate · 081 (typecheck, lint, format, full unit, full e2e) | coordinator | 13:54 (17 Oct) | 30 min | ~14:30 | ~35 min | +5 min | — | ✅ lint, format, typecheck, unit (6 port-busy files re-ran green 163/163), full e2e 93 passed |
| 081 · today's private orders in Pickup & delivery (phone, Directions) | builder · sonnet | 13:44 (17 Oct) | 30 min | 13:54 | ~9 min | −21 min | seller-saturday PrivateRow, usePrivateHandover, HandOverScreen, PickupView, DeliveryRunScreen, e2e step | ✅ unit 388, e2e 1/1, coordinator checked live at 390 px |
| 081 · fix: private chef-summary follows the per-chef income rules | fixer · sonnet | 12:35 (17 Oct) | 15 min | ~13:05 | ~3 min | −12 min | routes.ts, private.ts, Repository.ts, private.test | ✅ owner all rows, chef own row, chef 403 when off, helper 403 |
| 081 · stages 4–5: Cook/Pack/labels/income, Orders + Deliveries, customer page, Help, docs, D-104, e2e | builder · sonnet | 12:14 (17 Oct) | 75 min | 12:35 | ~21 min | −54 min | seller-cook, labels, chef-income, Orders `PrivateToday`, Deliveries, customer page, Help topic 14, D-104, docs, e2e `p081-private-orders` | ✅ typecheck, unit 357/357, eslint, e2e 1/1; found a chef-summary access bug (worker) |
| 081 · stage 3: seller screens (Private list, editor, detail, nav, More count, DishPicker) | builder · sonnet | 11:58 (17 Oct) | 60 min | 12:14 | ~16 min | −44 min | new `src/features/seller-private/` (~3,000 incl. tests), `src/api/private.ts`, `DishPicker` out of DishesStep, nav/rail/phone bar | ✅ typecheck, unit 169/169 (44 new) |
| 081 · stages 1–2: data, LIVE_MENU guard, private repo, routes | builder · sonnet | 11:42 (17 Oct) | 60 min | 11:57 | ~15 min | −45 min | migration 0027, `worker/db/private.ts` (482), `shared/privateContract.ts` (231), 14 live-menu SQL sites, routes, `mocks/private.test.ts` (12) | ✅ typecheck, private 12/12, 10 related mocks files 113/113 |
| 081 · design check (data model, day tools, stages) | Plan · opus (uncertain design) | 11:36 (17 Oct) | 10 min | 11:41 | ~5 min | −5 min | — (read-only) | ✅ saved in plan 081 "Build design" |
| 081 · mock-up: private orders (list, editor, detail, Cook tag, customer page) | builder · sonnet | 11:28 (17 Oct) | 30 min | 11:32 | ~4 min | −26 min | new `uxDesign/seller/mockups/081-private-orders.html` (~480) | ✅ coordinator checked 5 screens, dark, ID, no console errors; ⏸ owner review |
| gate · 067 (typecheck, lint, format, full unit, full e2e, live check) | coordinator + 4 sonnet fixers | 23:41 (16 Oct) | 40 min | ~01:30 (17 Oct) | ~110 min | +70 min | fixes: lint (rem/tokens, hook in test, any), customer picture moved into `DishesView`, library grid CSS | ✅ lint, format, typecheck, unit (flakes re-ran green), full e2e 92 passed, live check by eye |
| 067 · build all 3 stages (migration 0026, worker routes, seller editor + library, customer rows + enlarge, Help, docs) | builder · sonnet | 18:40 (16 Oct) | 60 min | 18:54 | ~14 min | −46 min | 37 files +462/−34, 6 new (migration 0026, DishPictureField, 3 unit test files, e2e spec) | ✅ typecheck; gate next |
| 067 · mock-up: dish pictures (seller editor, library, customer rows, enlarge) | builder · sonnet | 18:25 (16 Oct) | 30 min | 18:28 | ~3 min | −27 min | new `uxDesign/seller/mockups/067-dish-pictures.html` (+396) | ✅ coordinator checked 4 screens, light/dark, EN/ID, no console errors; ⏸ owner review |
| 075 · About hero: pop-out drone Lottie (owner A, 16 Oct) | builder · sonnet | 08:57 (16 Oct) | 25 min | 09:00 | ~5 min | −20 min | AboutHero, aboutTokens, AboutScreen (pin above), test; calm JSONs → popout JSONs | ✅ typecheck, unit 8, eslint, e2e seller-about 2/2; coordinator checked in the local app: drone over the logo row, taps pass through, no sideways scroll |
| 077 · UTC stored, device time shown (all 4 stages) | builder · sonnet | 06:27 (16 Oct) | 90 min | 06:57 | ~30 min | −60 min | ~55 code files +376/−194, `shared/zone.ts`, `YourTime`, migration 0025, docs | ✅ gated: typecheck, lint, format, unit 2,123 (2 fixes by the coordinator; port-busy files re-ran green 158/158), full e2e 91 passed (31 skipped) |
| 078 · admin page Layout A (pinned header, menu + sections, compact devices, resizable column, phone dropdown) | builder · sonnet | 22:36 (15 Oct) | 60 min | 22:56 | ~15 min | −45 min | `AdminHomeScreen` rewritten, `useSection`, `useColumnWidth`, `DevicesPanel`, signout icon, tests, admin-maintenance spec | ✅ gated: unit 243, e2e admin 2 + maintenance 1, lint, format |
| 080 · top bars push the page down + Bobo speech bubble | builder · sonnet | 21:41 (15 Oct) | 60 min | 21:48 | ~10 min | −50 min | `src/theme/screen.ts`, `topBars.ts`, 3 bars, ~25 layouts, PageHeader/SlideOver/rail offsets | ✅ gated: full unit 2,228/2,228, full e2e 91 passed (31 skipped), lint, format; captures ✅ |
| 079 · Help inside the seller app | builder · sonnet | 21:31 (15 Oct) | 40 min | 21:40 | ~25 min | −15 min | HelpScreen `embedded`, `/seller/help` route, nav, tests, e2e `seller-help-in-app` | ✅ gated: unit 165 + 15, e2e 2/2 × 2 + helper-flow, Print contrast fixed |
| 075 · About page + releases panel + calm Lottie (seller app) | builder · sonnet | 20:24 (15 Oct) | 60 min | 20:30 | ~7 min | −53 min | new `src/features/seller-about/` + nav/rail/routes, `info` icon, lottie-web 5.12.2, 2 calm JSONs, e2e spec | ✅ built + gated |
| 076 · pickup places on the map (migration 0024, seller Address, customer View on map / Directions) | builder · sonnet | 20:24 (15 Oct) | 75 min | 20:36 | ~12 min | −63 min | migration 0024, `shared/pickupAddress.ts`, `src/components/pickup-map/`, worker pickup + routes, PickupPane, 4 customer screens, SlideOver focus fix, e2e spec | ✅ built + gated |
| gate · 075 + 076 (typecheck, lint, format, full unit, 2 specs × 2 projects) | coordinator | 20:36 | 25 min | 21:30 | ~70 min | +45 min | 5 unit + 4 lint fixes by the builders; lint needs `NODE_OPTIONS=--max-old-space-size=8192` | ✅ green: unit 2,221 (after fixes 184/184 changed), e2e 6/6, lint, format |

## Before "ready to merge" (checked stage by stage against every plan, 18:35)

**Building or queued**
- [ ] 028 stage 4: built; e2e `helper-flow` at the gate
- [x] 030 stage 2: built (18:37); e2e `chef-dishes` at the gate
- [x] 032 stages 3–4: built (18:51), migration 0012; e2e pause being written; stages 1–2 being confirmed
- [x] 042: built (18:44); e2e `print-orders` at the gate; printed totals are pre-orders only
- [x] 031: postponed by the owner (not in this deploy)
- [x] 026 stage 4 leftovers: filter, paging, Clear (18:55)
- [ ] 039 deviations the owner was told about: Send reminder and Download CSV on Orders (not in the app yet), delivery start time (no data); keep as findings unless the owner asks

**Found, to fix before the gate**
- [x] the Orders badge counts cancelled orders (50 vs Home's 44): fixed 18:50
- [x] a new seller's row on the admin page has no summary line until reload: fixed 18:55
- [x] the coordinator's D-007 privacy check of the error log (plan 026): fields and scrubbing fine, except order codes kept in seller paths → fixed 18:40

**End-of-phase gate (one parallel run, quiet tree)**
- [x] new/changed specs sorted (18:48): 126 tests in 33 files; captures opt-in (`CAPTURES=1`); day-selling and seller-setup sequential
- [x] typecheck · lint (8 GB) · format:check · every unit test: 1796/1796 (one port-clash flake passed alone), 19:08
- [x] full e2e: main parallel projects 66 passed (run 6); sequential chain 28 passed, 0 failed (20:50)
- [ ] the specs each plan names: 024 `kitchen-links`, `customer-batch1` · 036 `seller-auth`, `session-flow` · 037 `design-compare` Menu-*, `live` · 038/041 `admin`, `seller-setup` · 040 `banners`, `seller-rail` · 029 `day-selling` · 028 `helper-flow` · 030 `chef-dishes` · 042 `print-orders`
- [ ] captures: 040 (4 sizes, open/collapsed/scrolled), 041 admin Images at 390 × 844, 042 printed pages, Home states
- [x] the owner's local database: 0011 and 0012 applied (20:16; backup in scratch/backup/wrangler-state-2026-10-11-before-0011-0012); dev server back on :5173
- [ ] plans index: tick ✅ and statuses; board "Start here"; the son's deploy checklist

**The owner's own checks (after merge, on the live app)**
- 027 a named admin device on the iPad · 028 invite a helper and try it on a phone · 029 a pretend stall day on two devices · 030 a chef adds a dish · 031 open the demo kitchen as admin · 032 an invite link on the phone, pause and resume · 042 a real print or PDF








| gate: typecheck · lint · format · all unit tests, then full e2e parallel | coordinator · shell | 20:22 | 25 min | | | | — | ⏳ |
























| final gate (071 round): typecheck · lint · format · unit, then full e2e | coordinator · shell | 22:20 | 40 min | | | | — | ⏳ |










## Done (newest first)

| date | plan · stage | agent · tier | started | est. | ended | took | ± est. | diff | state |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-14 | final gate: typecheck · lint · format · unit 2,199 · e2e 81/81 (fixer: maintenance spec runs alone) | coordinator + fixer | 07:20 | 50 min | 08:30 | 70 min | +20 min | 4 e2e files | ✅ |
| 2026-10-14 | 073 · 4–5 Cook made ± and Pack ticks saved in one go (shared auto-save in src/components), admin home 6 → 1 request | builder · sonnet | 07:11 | 40 min | 07:30 | 19 min | −21 min | ~12 files | ✅ 553 tests, e2e admin 3/3 |
| 2026-10-14 | fix: live events carry the sender's device id (X-Device-Id), only a device's own echo is ignored; customers never see it | builder · sonnet | 07:14 | 25 min | 07:30 | 16 min | −9 min | ~8 files, 1 new | ✅ 59 tests, 2 e2e |
| 2026-10-14 | 074 · B customer one live connection (token-scoped, hibernating), notification → refresh, status line; 15 s poll removed | builder · sonnet | 06:43 | 90 min | 07:18 | 35 min | −55 min | ~20 files, 4 new | ✅ 30 new tests, 3 e2e incl. Ready in < 2 s |
| 2026-10-14 | 074 · A seller Sell / Hand over / Orders / Cook on live (0 requests when connected), event-aware loaders, 1 sale = 1 request, admin backup settings (0023) | builder · sonnet | 06:43 | 60 min | 07:05 | 22 min | −38 min | ~20 files, 5 new tests | ✅ 710/711 (1 flake), 2 e2e; ⚠ echo-ignore window may swallow another device's event for 5 s |
| 2026-10-14 | 073 · 1–3 wizard ops refresh only what changed (1+7 → 1), menu badge + settings caches; e2e pending (blocked by in-flux 074) | builder · sonnet | 06:45 | 45 min | 07:03 | 18 min | −27 min | ~15 files, 3 new | ✅ unit; ⚠ its full-suite e2e run stopped by PID |
| 2026-10-13 | 072 · tick freely, one save after 1 s; flush on leaving; Not saved yet / Try again; prices batched | builder · sonnet | 22:53 | 45 min | 23:15 | 22 min | −23 min | ~10 files, 3 new | ✅ 68 tests, 2 e2e |
| 2026-10-13 | 046 · 1–3 maintenance notice bar + Updating screen + admin panel + token endpoint (0022); guard cached 10 s | builder · sonnet | 22:29 | 60 min | 23:12 | 43 min | −17 min | ~20 files | ✅ unit + e2e admin 3/3 |
| 2026-10-13 | audit: requests too often / too granular → plan 073 draft (4 stages) | builder · sonnet · read-only | 22:55 | 25 min | 23:08 | 13 min | −12 min | 1 doc | ✅ |
| 2026-10-13 | fixer: menu finish back to 10 trips (removed a duplicate menu read); the 11th was the new maintenance guard | builder · sonnet | 22:45 | 15 min | 22:58 | 13 min | −2 min | 1 file | ✅ chefIncome 8/8 |
| 2026-10-13 | docs: "State and data flow" (8 slices, 4 contexts, 4 diagrams) + "Database trips (the budget)" | builder · sonnet | 22:47 | 30 min | 23:05 | 18 min | −12 min | 3 docs + 1 line | ✅ 23 pages, diagrams render |
| 2026-10-13 | 071 follow-ups: SlideOver slides in (all panels), View on map in-app, "Address changed" + "Got it ✓" / customer "seen" (0020, 0021) | builder · sonnet | 22:22 | 30 min | 22:48 | 26 min | −4 min | ~15 files | ✅ 33 tests, e2e p071-address |
| 2026-10-13 | docs site: sticky header + menu, full width, ⤢ Enlarge viewer for diagrams/images | builder · sonnet | 22:32 | 15 min | 22:50 | 18 min | +3 min | 2 files | ✅ browser-checked |
| 2026-10-13 | Help: only the list and content scroll on tablet/desktop; topic 13 "address not available" (no keys) | builder · sonnet | 22:29 | 15 min | 22:40 | 11 min | −4 min | 2 files | ✅ 13 tests, browser check |
| 2026-10-13 | 071 · 4–5 customer code (0019), device address book (IndexedDB), link sheet, CSV backup/restore, Help topic 13; location UX, privacy modal, in-app map panel (MAPS_EMBED_KEY) | builder · sonnet | 21:38 | 60 min | 22:18 | 40 min | −20 min | ~35 files | ✅ unit + 3 e2e |
| 2026-10-13 | 071 · 1–3 encrypted addresses (0018), guided checkout form + privacy line, seller Deliveries + Directions; texts updated | builder · sonnet | 21:00 | 75 min | 21:50 | ~50 min | −25 min | ~30 files, 8 new | ✅ 13+15 tests, 3 e2e |
| 2026-10-13 | 069 · 3 per-chef snapshot kept on past menus (migration 0017), docs updated | builder · sonnet | 20:35 | 30 min | 20:52 | 17 min | −13 min | 3 files + docs | ✅ 12 + 281 tests, e2e seller-history |
| 2026-10-13 | 069 · per-chef income: endpoint (1 round trip), button + panel in 4 places, Team setting (migration 0016); older past menus have no chef split | builder · sonnet | 20:12 | 60 min | 20:50 | 38 min | −22 min | ~20 files, 4 new | ✅ 1196 tests, 3 e2e |
| 2026-10-13 | 070 · branded docs site (22 pages, `pnpm run docs`), 6 sequences, 3 UX flows, CLAUDE.md rule | builder · sonnet | 20:24 | 60 min | 20:45 | 21 min | −39 min | 7 new, 5 edited | ✅ |
| 2026-10-13 | docs: architecture refreshed (overview, data model 0001–0016, API, sign-in) + new source-layout page | builder · sonnet | 20:19 | 40 min | 20:30 | 11 min | −29 min | 6 docs | ✅ 8 code/doc mismatches listed |
| 2026-10-13 | 068 · manifest ids, Menu tab own kitchen, My orders own kitchen first, home-screen card on coming-soon | builder · sonnet | 19:57 | 25 min | 20:25 | 28 min | +3 min | ~14 files | ✅ 726 tests, 2 e2e |
| 2026-10-13 | 060 follow-up: phone's language unless the seller picks one (0014 amended, local D1 fixed) | builder · sonnet | 06:42 | 25 min | 07:10 | 28 min | +3 min | ~12 files | ✅ 406 tests, 2 e2e; ⚠ killed all node processes (lesson 24) |
| 2026-10-13 | night gate: typecheck · lint · format · unit · e2e 76/76 (1 real bug fixed, 2 specs updated, 1 overnight hang while the PC slept) | coordinator + fixer | 23:24 | 40 min | 06:36 | 7 h (6 h asleep) | — | — | ✅ |
| 2026-10-12 | fixer: Settings draft re-written after Save (061 regression found by e2e) | builder · sonnet | 23:36 | 20 min | 23:45 | 9 min | −11 min | 2 files | ✅ 103 tests, e2e settings |
| 2026-10-12 | 063·1 (Details three-way; Menu defaults left two-way: owner question) + 063·3, 064·2 past pictures, 066·3 seller | builder · sonnet | 23:05 | 60 min | 23:22 | 17 min | −43 min | ~15 files, 3 new tests | ✅ 96 tests, e2e seller-menu + seller-history |
| 2026-10-12 | 062·4–5 (403 "not allowed" texts, banners stack), 066·3 customer (50-dish e2e; customer dishes have no pictures) | builder · sonnet | 23:05 | 40 min | 23:20 | 15 min | −25 min | ~10 files, 1 new spec | ✅ 397 tests, 3 e2e |
| 2026-10-12 | 061 · 1–9 never lose typed data + 063·2 delivery-only basket fix | builder · sonnet | 22:25 | 70 min | 23:07 | 42 min | −28 min | ~35 files, ~12 new | ✅ 379 tests, 3 e2e |
| 2026-10-12 | Help: two tabs (Seller help / Customer help) + 7-question customer FAQ | builder · sonnet | 22:56 | 25 min | 23:06 | 10 min | −15 min | 5 files, 1 new | ✅ 13 tests |
| 2026-10-12 | 066 · 1–2 fifty dishes: limit 50, D1 100-variable bug fixed (json_each), print totals, WhatsApp post "+ N more" (coordinator set the post budget to 3000 so usual menus aren't cut) | builder · sonnet | 22:49 | 50 min | 23:00 | 11 min | −39 min | ~9 files | ✅ round trips ≤ 7 per route |
| 2026-10-12 | 065 · My orders: reload the last kitchen, kitchen pill between code and total | builder · sonnet | 22:42 | 30 min | 22:56 | 14 min | −16 min | 5 files | ✅ 58 tests, e2e native-customer + customer-batch2 |
| 2026-10-12 | bug: server refuses a fulfilment the menu doesn't offer (customers only; demo generator fixed) | builder · sonnet | 22:43 | 20 min | 22:48 | 5 min | −15 min | 4 files + test | ✅ 99 tests |
| 2026-10-12 | 064 · 1 server: keep last 10 menu pictures (needed migration 0015), rolling prune, reuse routes | builder · sonnet | 22:38 | 35 min | 22:49 | 11 min | −24 min | 2 new, 9 edited | ✅ 4 new tests; applied 0015 locally |
| 2026-10-12 | 062 · 1–3 retry policy (GET only), live loop + reconnect caps, offline banner, order poll | builder · sonnet | 22:31 | 60 min | 22:47 | 16 min | −44 min | 8 new, 5 edited | ✅ 35 tests, e2e live + order-flow; watch: banner overlaps the update bar |
| 2026-10-12 | D-097 · Devices on the phone (More row for every role, Help updated) | builder · sonnet | 22:34 | 20 min | 22:44 | 10 min | −10 min | 5 files | ✅ |
| 2026-10-12 | customer Settings: kitchen banner on top (a 10-line copy of the menu Banner; share it once customer-menu is free) | builder · sonnet | 22:30 | 15 min | 22:37 | 7 min | −8 min | 4 files | ✅ 11 tests, e2e native-customer |
| 2026-10-12 | Help topic 6 rewritten: pickup places + menu defaults first, 13 steps in 3 parts | builder · sonnet | 22:28 | 15 min | 22:35 | 7 min | −8 min | 1 file | ✅ 9 tests |
| 2026-10-12 | 060 · the language customers see first (migration 0014, Settings control, langChosen flag) | builder · sonnet | 22:14 | 35 min | 22:33 | 19 min | −16 min | ~15 files, 2 new | ✅ 421 tests, e2e customer-batch1 + native-customer |
| 2026-10-12 | Help topic 2 "Phone or tablet?" (topics renumbered to 12, links + pictures shifted) | builder · sonnet | 22:23 | 15 min | 22:30 | 7 min | −8 min | 5 files | ✅ 29 tests; found: Devices is tablet-only on phones |
| 2026-10-12 | final gate: typecheck · lint · format · unit 1897 · e2e 74/74 (fixer: 3 spec updates, 4 load flakes) | coordinator + fixer · sonnet | 21:20 | 35 min | 22:08 | 48 min | +13 min | 3 spec files | ✅ |
| 2026-10-12 | 058 · 1 seller Help page (public hidden address, 6 real screenshots, links everywhere, waving mascot) | builder · sonnet | 21:01 | 50 min | 21:20 | 19 min | −31 min | ~25 files, 6 webp | ✅ 9 tests |
| 2026-10-12 | 059 · new-version bar, version.json (no-store), stale-chunk reload once | builder · sonnet | 21:05 | 30 min | 21:16 | 11 min | −19 min | 8 new, 3 edited | ✅ 6 tests, build ok |
| 2026-10-12 | editor round: 056·3 one field per text, 057·2 ⇄ in dish editor, sold-out names, language storage fix, setting descriptions | builder · sonnet | 21:01 | 40 min | 21:12 | 11 min | −29 min | ~18 files, 2 new | ✅ 159 tests |
| 2026-10-12 | 056 · 1–2 languages for customers (migration 0013, Settings → Kitchen, forced customer language) | builder · sonnet | 20:39 | 45 min | 21:02 | 23 min | −22 min | ~20 files, 4 new | ✅ e2e customer-batch1 3/3 |
| 2026-10-12 | 058 · 0 Help mock-up (11 topics, real names EN/ID, devices, home screen, waving mascot) | builder · sonnet | 20:50 | 20 min | 21:05 | 15 min | −5 min | temp/mockups/seller-help.html | ✅ |
| 2026-10-12 | 057 · 1 translate route, AI binding (remote off locally), 100/day cap, TranslateButton | builder · sonnet | 20:41 | 35 min | 20:55 | 14 min | −21 min | 6 new, ~10 edited | ✅ 10 + 281 tests with no token |
| 2026-10-12 | 056 · one language per dish is enough (CSV, import match, editor text) | builder · sonnet | 20:42 | 25 min | 20:52 | 10 min | −15 min | ~8 files | ✅ 508 tests; todo: worker/db/seller.ts sold-out messages use name.en |
| 2026-10-12 | 055 · publish now or paused, in a confirmation modal | builder · sonnet | 20:28 | 20 min | 20:46 | 18 min | −2 min | ~11 files, 2 new | ✅ 271 tests |
| 2026-10-12 | bug fix: draft menu hidden from customers ("coming soon") + 054 home-screen card | builder · sonnet | 20:09 | 60 min | 20:21 | 12 min | −48 min | ~14 files, 2 new | ✅ 667 tests, e2e customer-batch1 3/3 |
| 2026-10-12 | seller sign-in shows ShaggyBobo when no kitchen is remembered | builder · sonnet | 20:17 | 15 min | 20:21 | 4 min | −11 min | 4 files | ✅ 10 tests; captures/sign-in-fresh |
| 2026-10-12 | 050 · 3 CSV Import / Export / Template + 053 menu step tabs + phone More note | builder · sonnet | 20:08 | 65 min | 20:22 | 14 min | −51 min | 3 new, ~10 edited | ✅ 206 tests; captures/p050, p053 |
| 2026-10-12 | 051 · append-one-dish route (owner + chef own dish), client switched | builder · sonnet | 20:05 | 15 min | 20:14 | 9 min | −6 min | ~8 files | ✅ 47 tests; new error code already_on_menu |
| 2026-10-12 | 051 · dishes on the phone + chef "Add to menu" | builder · sonnet | 19:52 | 30 min | 20:06 | 14 min | −16 min | ~12 files, 1 new test | ✅ 180 tests; captures/p051 |
| 2026-10-12 | 040 · banner unlinked from left-menu collapse | builder · sonnet | 19:58 | 10 min | 20:04 | 6 min | −4 min | 4 files | ✅ 7 unit, e2e banners 3/3 |
| 2026-10-12 | 050 · 1–2 dish CSV parser + import endpoint (name + chef matching), and the D-094 server rule | builder · sonnet | 19:48 | 30 min | 20:02 | 14 min | −16 min | 3 new, 4 edited | ✅ 48 tests; no migration |
| 2026-10-12 | 052 · admin e2e WhatsApp URL + Refresh step | builder · sonnet | 19:51 | 8 min | 19:58 | 7 min | −1 min | 1 spec | ✅ admin e2e 2/2; no wa.me left in e2e |
| 2026-10-12 | 049 · Edit chefs in a modal over the dish editor | builder · sonnet | 19:45 | 25 min | 19:52 | 7 min | −18 min | ~14 files, 1 new test | ✅ 55 tests; e2e chef-dishes + seller-setup pass |
| 2026-10-12 | 052 · admin Last updated + Refresh (1/min) | builder · sonnet | 19:48 | 20 min | 20:04 | 16 min | −4 min | 1 new, 5 edited | ✅ 28 tests; admin e2e caught a wa.me expectation 047 missed |
| 2026-10-12 | 048 · seller app installable on every /seller page + in-app "Install the app" | builder · sonnet | 19:22 | 45 min | 19:48 | 26 min | −19 min | ~14 files, 3 icons, 1 manifest | ✅ 971 tests; Chrome install check: no errors on 3 seller pages |
| 2026-10-12 | 047 · link previews (small square: ShaggyBobo face / kitchen app icon) + WhatsApp via api.whatsapp.com | builder · sonnet | 19:06 | 35 min | 19:20 | 14 min | −21 min | ~20 files, 1 image | ✅ 1369 tests, e2e customer-batch1/2 |
| 2026-10-11 | 044 · new mascot (jump + blink), happy-face logo pill, top bar over the scene, phone without bars, `--legs-x` | builder · sonnet | 20:58 | 30 min | 21:30 | 32 min | +2 min | ~12 files, 6 new images | ✅ 139 tests, admin e2e 2/2, typecheck/lint/format clean |
| 2026-10-11 | sign-in form logo: beige container in light mode too | builder · sonnet | 20:46 | 8 min | 20:50 | 4 min | −4 min | 2 files | ✅ 8/8 |
| 2026-10-11 | the whole sequential chain (+ seller-auth / chef-dishes URL fixes) | builder · sonnet | 20:38 | 15 min | 20:50 | 12 min | −3 min | 2 specs | ✅ 28 passed, 0 failed, 9 skipped (mobile-only skips) |
| 2026-10-11 | 044 mock-up `temp/shaggybobo-new/mockup-admin-page.html` (git-ignored, beside the assets) | coordinator · opus | 20:45 | 10 min | 20:50 | 5 min | −5 min | 1 mock-up | ✅ light + dark sent |
| 2026-10-11 | bug fix: helper pages no longer request past-weeks; read-only preferences allowed for helpers | builder · sonnet | 20:34 | 15 min | 20:41 | 7 min | −8 min | 3 files | ✅ helper-flow passes, 0 console errors; 151 tests |
| 2026-10-11 | gate fixes: admin strict text, session-flow admin list, helper-flow Sell locator | builder · sonnet | 20:31 | 15 min | 20:37 | 6 min | −9 min | 3 specs | ✅ 2 pass; helper-flow found a real app bug |
| 2026-10-11 | gate: sequential + affected e2e projects, one at a time | coordinator · shell | 20:28 | 12 min | 20:30 | 2 min | −10 min | — | ⚠️ 24 passed, 3 failed (first full run of these specs), 1 not run |
| 2026-10-11 | 043 · 1–3 invite message EN/ID + admin invite list (newest 20) | builder · sonnet | 20:13 | 30 min | 20:27 | 14 min | −16 min | ~12 files | ✅ 125 tests |
| 2026-10-11 | gate fix: admin spec serial (shared passkey) | builder · sonnet | 20:13 | 5 min | 20:16 | 3 min | −2 min | 1 spec | ✅ 2/2 with default workers |
| 2026-10-11 | gate: full e2e, run 6 | coordinator · shell | 20:05 | 20 min | 20:12 | 7 min | −13 min | — | ⚠️ 66 passed, 1 failed (admin passkey clash), 7 not run behind it |
| 2026-10-11 | e2e devices reorganised (owner: iPhone is about size): Chromium Android + desktop, iPhone-size Chromium set, 1 WebKit smoke last | builder · sonnet | 19:57 | 10 min | 20:01 | 4 min | −6 min | config, 3 specs, tech-stack.md | ✅ `--list` 102 tests |
| 2026-10-11 | gate fix: WebKit project timeout 60 s | builder · sonnet | 19:52 | 5 min | 19:54 | 2 min | −3 min | playwright.config.ts | ✅ |
| 2026-10-11 | gate: full e2e, run 4 | coordinator · shell | 19:40 | 15 min | 19:51 | 11 min | −4 min | — | ⚠️ 54 passed, 2 WebKit timeouts (30 s limit), 41 sequential not run |
| 2026-10-11 | gate fixes: 3 WebKit failures | builder · sonnet | 19:38 | 15 min | 19:44 | 6 min | −9 min | 1 spec | ✅ 1 URL fixed; 2 passed alone (WebKit slowness under load; watch in run 4) |
| 2026-10-11 | gate: full e2e, run 3 (WebKit) | coordinator · shell | 19:26 | 15 min | 19:37 | 11 min | −4 min | — | ⚠️ 53 passed, 3 failed (WebKit: 1 old URL, 1 stays on New order, 1 timeout), 41 not run |
| 2026-10-11 | gate: full e2e, run 2 | coordinator · shell | 19:19 | 15 min | 19:25 | 6 min | −9 min | — | ⚠️ 41 passed; all 26 failures = WebKit not installed on this PC (installed 19:27) |
| 2026-10-11 | gate fixes: 6 e2e failures (outdated expectations) | builder · sonnet | 19:16 | 15 min | 19:23 | 7 min | −8 min | 4 specs | ✅ each passes alone (phone banner is unchanged by design, so the phone header doesn't move) |
| 2026-10-11 | gate: full e2e suite, parallel | coordinator · shell | 19:08 | 15 min | 19:15 | 7 min | −8 min | — | ⚠️ 34 passed, 6 failed (all outdated expectations), 70 not run (wait on those), 18 skipped |
| 2026-10-11 | gate: typecheck · lint · format · all unit tests | coordinator · shell | 18:57 | 10 min | 19:07 | 10 min | 0 | — | ✅ 1796/1796 (1 flake passed alone) |
| 2026-10-11 | 032 e2e + st1–2 check · new-seller summary · 026 filter / paging / Clear | builder · sonnet | 18:51 | 25 min | 18:55 | 4 min | −21 min | ~10 files | ✅ 112 tests |
| 2026-10-11 | 032 · 3–4 pause a kitchen (full / customers only), notice slot for 031 | builder · sonnet | 18:32 | 40 min | 18:51 | 19 min | −21 min | migration 0012, ~20 files | ✅ new tests; miniflare flakes pass alone |
| 2026-10-11 | gate prep: specs sorted parallel / sequential / opt-in; Running e2e note | builder · sonnet | 18:43 | 15 min | 18:48 | 5 min | −10 min | config, 1 spec, tech-stack.md | ✅ `--list` 126 tests |
| 2026-10-11 | chef-nav test + chefMenu test typecheck | builder · sonnet | 18:45 | 5 min | 18:50 | 5 min | 0 | 2 tests | ✅ typecheck clean, 27 tests |
| 2026-10-11 | Orders badge excludes cancelled; print totals labelled pre-orders; order code no wrap | builder · sonnet | 18:45 | 8 min | 18:50 | 5 min | −3 min | 3 files | ✅ unit; code wrap checked at the gate capture |
| 2026-10-11 | 042 · print orders on A4 | builder · sonnet | 18:32 | 30 min | 18:44 | 12 min | −18 min | 4 new, 4 edited | ✅ 9 tests |
| 2026-10-11 | 026 · privacy fix: order codes masked in logged paths | builder · sonnet | 18:38 | 5 min | 18:40 | 2 min | −3 min | 2 files | ✅ 17 tests |
| 2026-10-11 | 030 · 2 chef's menu screens | builder · sonnet | 18:32 | 25 min | 18:37 | 5 min | −20 min | 4 new, ~8 edited | ✅ 103 tests |
| 2026-10-11 | 028 · 4 helper's screens | builder · sonnet | 18:21 | 35 min | 18:33 | 12 min | −23 min | ~15 files, 1 new spec, 1 new project | ✅ 284 tests; e2e helper-flow at the gate |
| 2026-10-11 | 038 · 4 e2e `admin` + 3 screenshots (2 runs) | coordinator · shell | 18:21 | 5 min | 18:28 | 7 min | +2 min | — | ✅ 1/1, captures/p038/ |
| 2026-10-11 | 041 · R2 wiring + admin e2e on the real route (the harness had no Images) | builder · sonnet | 18:21 | 5 min | 18:31 | 10 min | +5 min | routes.ts, r2.ts, spec, 1 test | ✅ 119 + 27 tests |
| 2026-10-11 | 029 · 4–5 Sell screen + end-of-day summary + phone e2e | builder · sonnet | 17:48 | 45 min | 18:19 | 31 min | −14 min | 7 new, ~12 edited | ✅ 485 tests, e2e day-selling ✓; its accidental full run showed 3 failing specs to triage |
| 2026-10-11 | 038 · 4 admin side panel with Invitations / Settings tabs + dark-mode EN/ID fix | builder · sonnet | 17:49 | 35 min | 18:05 | 16 min | −19 min | admin feature + tests | ✅ 26 unit; e2e waits (server busy) |
| 2026-10-11 | 041 · 1–2 admin sets a kitchen's images | builder · sonnet | 17:39 | 40 min | 17:50 | 11 min | −29 min | ~12 files | ✅ 122 tests; routes.ts wiring (1 line) waits for 029 |
| 2026-10-11 | 029 · 1 UI (dish editor, customer menu) + 3 live updates | builder · sonnet | 17:41 | 40 min | 17:49 | 8 min | −32 min | ~10 files | ✅ 50 tests |
| 2026-10-11 | 040 · fix: 4 mocks tests for the sample rename; Settings board note | builder · sonnet | 17:43 | 8 min | 17:46 | 3 min | −5 min | 4 tests, 1 board | ✅ 84/84 |
| 2026-10-11 | 040 · fix: banner collapses with the left menu | builder · sonnet | 17:41 | 10 min | 17:46 | 5 min | −5 min | 3 files | ✅ 541/541 unit, e2e 4/4 |
| 2026-10-11 | 029 · 1–2 server: preorder / day stock, atomic sales + log (migration 0011) | builder · sonnet | 17:25 | 45 min | 17:41 | 16 min | −29 min | 4 new, 15 edited | ✅ 17 new tests; 4 mocks tests broken by 040's sample rename → fix queued |
| 2026-10-11 | 040 · 1–4 top band | builder · sonnet | 17:20 | 60 min | 17:40 | 20 min | −40 min | 10 files | ✅ 609/610 → fixed; e2e banners + seller-rail 4/4 |
| 2026-10-11 | 040 · 5c e2e specs for the new image labels | builder · sonnet | 17:25 | 5 min | 17:27 | 2 min | −3 min | 2 specs | ✅ lint; Playwright at the gate |
| 2026-10-11 | 040 · 5b app icon label + phone icon guide | builder · sonnet | 17:23 | 10 min | 17:26 | 3 min | −7 min | 4 files | ✅ 19/19 |
| 2026-10-11 | 040 · 5 upload instructions + in-place guide + template download | builder · sonnet | 17:20 | 30 min | 17:24 | 4 min | −26 min | 1 new component, 5 guides, i18n | ✅ 19/19 |
| 2026-10-11 | gate fixes: 2 customer tests (1 real bug from 037: customer pages had stopped sliding in), 2 files formatted | builder · sonnet | 17:13 | 15 min | 17:20 | 7 min | −8 min | AppRoutes 1 line, 1 test | ✅ 334 + 52 tests |
| 2026-10-11 | gate: lint again with `NODE_OPTIONS=--max-old-space-size=8192` | coordinator · shell | 17:13 | 6 min | 17:17 | 4 min | −2 min | — | ✅ 0 errors |
| 2026-10-11 | gate: lint · format:check · all unit tests | coordinator · shell | 17:03 | 8 min | 17:12 | 9 min | +1 min | — | ⚠️ unit 1703/1705 (2 customer); format 2 files; lint out of memory |
| 2026-10-11 | fixes from captures: admin header at 390 px; Orders "0 orders" | builder · sonnet | 17:00 | 15 min | 17:03 | 3 min | −12 min | 2 files, 1 new test | ✅ 155 tests; the new test fails without the fix |
| 2026-10-11 | 037 · 1–3 menu wizard as a layer | builder · sonnet | 16:47 | 50 min | 17:00 | 13 min | −37 min | 3 new, ~10 edited | ✅ 190/191 (the 1 is CustomerShell, to check) |
| 2026-10-11 | banner templates (8:1 and phone 3:1 zone images) | coordinator · opus | 16:58 | 5 min | 17:01 | 3 min | −2 min | 2 SVG + 2 PNG + 1 sample | ✅ |
| 2026-10-11 | 039 · 038 · captures for the owner | builder · sonnet | 16:48 | 25 min | 17:00 | 12 min | −13 min | new `e2e/p039-captures.spec.ts` | ✅ 3/3, 0 console errors; 2 defects found |
| 2026-10-11 | banner mock-up `uxDesign/seller/mockups/banner-sizes.html` + 6:1 / 8:1 samples | coordinator · opus | 16:53 | 15 min | 17:00 | 7 min | −8 min | 1 mock-up, 2 sample images | ✅ checked at 1180×820 |
| 2026-10-11 | 030 · 1 server rules: chefs add and edit their own dishes | builder · sonnet | 16:47 | 25 min | 16:58 | 11 min | −14 min | routes.ts, 1 new test file | ✅ 80 tests; full server suite at the gate |
| 2026-10-11 | banner sizes · UX review | general · opus | 16:48 | 8 min | 16:52 | 4 min | −4 min | — | ✅ cap seller banner at 160 px (one constant); phone stays 3:1 |
| 2026-10-11 | 039 · 4–5 Home live states, Orders slimmed (+2 gate fixes) | builder · sonnet | 16:28 | 50 min | 16:45 | 17 min | −33 min | 4 new, ~16 edited | ✅ 273/273 unit; Send reminder + CSV not built (don't exist yet) |
| 2026-10-11 | 028 · 3 invite and list (+ ID label "Asisten") | builder · sonnet | 16:43 | 20 min | 16:48 | 5 min | −15 min | 4 files + i18n | ✅ 42 tests |
| 2026-10-11 | owner's local DB: migrate 0009 + 0010 (add-only; backup first) | coordinator · shell | 16:41 | 3 min | 16:42 | 1 min | −2 min | — | ✅ `/api/log` 204 on :5173 |
| 2026-10-11 | 028 · 1–2 helper role: migration 0010, contract, server allowlist | builder · sonnet | 16:34 | 40 min | 16:40 | 6 min | −34 min | 4 files edited, 3 new | ✅ 694 server tests |
| 2026-10-11 | 026 · 4 admin sees the error log (Problems panel) | builder · sonnet | 16:28 | 25 min | 16:33 | 5 min | −20 min | 8 files, 1 new | ✅ 108 tests; filter, paging, Clear left for later |
| 2026-10-11 | 039 · e2e specs + guards link for `/seller/orders` | builder · sonnet | 16:28 | 20 min | 16:31 | 3 min | −17 min | 15 files, ~1 line each | ✅ typecheck, lint; Playwright at the gate |
| 2026-10-11 | 028 · re-plan after 033 | Plan · sonnet | 16:25 | 6 min | 16:26 | 1 min | −5 min | plan only | ✅ helper = 3rd membership role; 2 rulings |
| 2026-10-11 | 038 · 3 seller-row summary | builder · sonnet | 16:23 | 25 min | 16:26 | 3 min | −22 min | 6 files, 3 tests | ✅ 110 tests; server 683/683 |
| 2026-10-11 | 039 · 2–3 Home: routes, nav, states 1/2/5–6, dialogs, panel | builder · sonnet | 16:09 | 45 min | 16:24 | 15 min | −30 min | ~20 new files, 8 edited | ⚠️ typecheck ok; 130/131 unit, 1 lint → fixed in 4–5 |
| 2026-10-11 | 026 · fix `token=` scrub (+ a 2nd scrub-order bug it found) | builder · sonnet | 16:21 | 5 min | 16:24 | 3 min | −2 min | 1 file, ~3 lines | ✅ lint clean, unit green |
| 2026-10-11 | 038 · fixes: lint, failing test (test was wrong), lighter left panel + headings, e2e selectors, unused keys | builder · sonnet | 16:16 | 15 min | 16:22 | 6 min | −9 min | 8 files, 1 new test | ✅ lint clean, 20/20 unit; e2e + screenshots at the gate |
| 2026-10-11 | 026 · 1–3 client error log | builder · sonnet | 16:17 | 30 min | 16:20 | 3 min | −27 min | 9 new files, 7 edited (+~450) | ⚠️ lint clean; 35/36 unit → fix |
| 2026-10-11 | 038 · 1–2 admin two panels + brand bar | builder · sonnet | 16:09 | 30 min | 16:14 | 5 min | −25 min | 8 files, 1 new | ⚠️ typecheck ok; lint 3 errors, 1 test failing → fixes |
| 2026-10-11 | 024 · 1–2 customer theme from the first paint (+ lint fix) | builder · sonnet | 16:09 | 30 min | 16:16 | 7 min | −23 min | 8 files +120/−17, 3 new | ✅ typecheck, lint, 419/419 unit |
| 2026-10-11 | unfinished plans · fastest order, parallel tracks | Plan · fable | 16:05 | 6 min | 16:08 | 3 min | −3 min | — | ✅ Home first: yes; 3 tracks |
| 2026-10-11 | 039 · 0 design boards into `uxDesign/seller/screens/` | coordinator · opus | 16:04 | 5 min | 16:05 | 1 min | −4 min | 7 boards added, Main + Main-Finished replaced, Main-Empty removed, index merged (28 boards) | ✅ |
| 2026-10-11 | Playwright Chromium install (for specs and captures) | coordinator · shell | 16:04 | 3 min | 16:05 | 1 min | −2 min | — | ✅ |
| 2026-10-11 | 036 · rebase on `plan/flow-and-prototype`, renumber 027/028 → 036, 037 | coordinator · opus | ~15:25 | 10 min | ~15:40 | ~15 min | +5 min | 2 conflicts; 12 files (renames, comments, index) | ✅ typecheck, 254/254 unit |
| 2026-10-11 | 037 · map the menu wizard (review) | Explore · haiku | ~14:55 | 2 min | ~14:56 | 1 min | −1 min | — | ✅ |
