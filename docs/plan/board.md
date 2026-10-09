# Board

Live status of the current round. The plan itself (phases, stage tables, folder structure) is in [roadmap.md](roadmap.md); rulings are in [decisions](../decisions/README.md). Times are clock times on the dev PC. Note: phase 2 and stage 3.0 times above were estimated and run ahead of the real clock; from wave 1 on they are read from the PC clock.

## Summary

| phase | state | next |
|---|---|---|
| 0 · Plan | ✅ done 2026-10-07 (D-003 to D-015) | — |
| 1 · Scaffold | ✅ landed ~20:24, gate verified by the coordinator | owner: open the hello screen on a phone |
| 2 · Wireframes | ✅ done: batches 1–4 approved | — |
| 3 · Prototype | ✅ batches 1–2, desktop seller layout, native customer app, owner's images, **multi-seller foundation** (02:19, 9 Oct) and **batch 3** (menu editor, setup + images, labels, history, archived orders; 04:54, 9 Oct) | owner commits; polish round; batch 4 stage table |
| 4–5 | ⏳ not started | — |

## Phase 1 · Scaffold (round 1)

One builder, alone on the tree. Stage table in [roadmap.md](roadmap.md#phase-1--scaffold-stage-table).

| item | agent · tier | started | ETA | landed | diff | state |
|---|---|---|---|---|---|---|
| 1 · Vite + React + TS, Cloudflare plugin, HTTPS | builder · sonnet | ~20:15 | ~21:15 | ~20:24 | ~40 new files (whole phase) | ✅ |
| 2 · ESLint, no-cycle, layer rules, Prettier | builder · sonnet | ~20:15 | ~21:15 | ~20:24 | ~40 new files (whole phase) | ✅ |
| 3 · App skeleton: store, saga, i18n, theme + contrast test, hello screen | builder · sonnet | ~20:15 | ~21:15 | ~20:24 | ~40 new files (whole phase) | ✅ |
| 4 · Worker `/api/health`, shared contract, MSW | builder · sonnet | ~20:15 | ~21:15 | ~20:24 | ~40 new files (whole phase) | ✅ |
| 5 · Playwright (iPhone, Android, desktop), smoke spec, captures | builder · sonnet | ~20:15 | ~21:15 | ~20:24 | ~40 new files (whole phase) | ✅ |
| Gate + review by the coordinator | coordinator | 20:25 | | 20:28 | — | ✅ typecheck, lint, format, 36/36 unit, e2e 3/3 (iPhone, Android, desktop); capture looked at |

**Checkpoints:** before 3.6, `scratch/checkpoints/pre-palette.tar` (22:52). Before 3.5, `scratch/checkpoints/pre-3.5.tar` (22:13). Before wave 1, `scratch/checkpoints/pre-wave1.tar` (21:48; after the owner's commit a1d4a02). Before phase 1, the uncommitted docs were snapshotted to `scratch/checkpoints/pre-phase1-docs.tar` (20:20).

## Phase 2 · Wireframes (round 2)

Batches in [D-017](../decisions/README.md): 1 core loop · 2 after ordering · 3 seller setup (incl. banner editor) · 4 sign-in and Saturday.

| item | agent · tier | started | ETA | landed | diff | state |
|---|---|---|---|---|---|---|
| Batch 1: C1 menu (EN + ID), C2 basket/checkout, C3 order placed + WhatsApp text, S1 order list, S2 order detail | builder · sonnet | 20:40 | ~21:10 | ~20:45 | `docs/design/wireframes/batch-1.html` (+297 lines) | ✅ approved with changes (D-018) |
| Batch 1 fixes: 3 content mismatches + order notes (D-018) | builder · sonnet | 20:55 | ~21:10 | ~21:00 | `batch-1.html` (draft 2) | ✅ approved |
| Batch 2: C4 My orders, C5 order page (before cut-off + Ready), S3 add order for WhatsApp customer (+ link sent), S4 cook list by chef, S5 WhatsApp post | builder · sonnet | 21:05 | ~21:20 | ~21:12 | `docs/design/wireframes/batch-2.html` (+387 lines) | ✅ approved |
| Batch 2 fixes (2 mismatches) + batch 3: S6 menu, S7 item editor, S8 saved sets, S9 week settings, S10 banner, S11 chefs and people, S12 labels | builder · sonnet | 21:20 | ~21:40 | ~21:30 | `batch-2.html` (draft 2), `batch-3.html` (+400 lines) | ✅ approved with a change (D-019) |
| Batch 3 change: "Preview as customer" on S6 + new frame S6b (D-019) | builder · sonnet | 21:40 | ~21:50 | ~21:45 | `batch-3.html` (draft 2) | ✅ landed; S9 pill set to Draft by the coordinator |
| Batch 4: A1 invite key, A2 passkey help, A2b password fallback, A3 sign in, A4 admin page, A4b admin first setup, C6/C6b scan to collect, S13 seller hand-over, S13b delivery run | builder · sonnet | 21:55 | ~22:15 | ~22:02 | `docs/design/wireframes/batch-4.html` (+438 lines) | ✅ approved |

## Phase 3 · Prototype, batch 1 (round 3)

Stage table in [roadmap.md](roadmap.md#phase-3--batch-1-core-loop-stage-table). Rulings: D-021 (mock API in the dev Worker), D-022 (react-router).

| item | agent · tier | started | ETA | landed | diff | state |
|---|---|---|---|---|---|---|
| 3.0 Two visual directions (C1 + S1, light + dark, token/contrast table) | builder · sonnet | 22:15 | ~22:35 | ~22:25 | `docs/design/mockups/batch-1-directions.html` (+356 lines) | ✅ Sage picked (D-023) |
| 3.1 UI kit + status tokens + literal-values lint rule + kit harness (wave 1) | builder · sonnet | 21:49 | ~22:20 | | `src/ui/` +15, `src/theme/` +39/−2, `src/harness/` +1; tests 20 → 40 | ✅ landed by 21:58 |
| 3.2 Domain, contracts, API client, mock API in the dev Worker (wave 1) | builder · sonnet | 21:49 | ~22:20 | | `shared/` +14, `worker/` +6, `mocks/` +1, `src/api/` +3; tests 8 → 138 | ✅ landed by 21:58; mock tree-shaken from the build |
| Fix fixture weekdays (Sat 10 Oct, cut-off Fri 9 Oct 2026) | builder · sonnet | ~21:52 | | | `fixture.ts`, `contracts.test.ts`, `store.test.ts` | ✅ landed by 21:58 |
| Hello screen px → token (lint) | builder · sonnet | ~21:55 | | ~21:56 | 2 lines | ✅ |
| Wave 1 gate by the coordinator | coordinator | ~21:56 | | 21:58 | — | ✅ typecheck, lint, format, 186/186 unit, e2e kit + hello 9/9; kit capture looked at; no server left running |
| 3.3 Customer screens C1–C3 (wave 2) | builder · sonnet | 22:01 | ~22:40 | | `src/features/customer-menu/` +21, `src/main.tsx`, `src/harness/customer.tsx`, e2e spec; 40 tests | ✅ landed |
| 3.4 Seller screens S1–S2 (wave 2) | builder · sonnet | 22:01 | ~22:40 | | `src/features/seller-orders/` +18, `src/harness/seller.tsx`, e2e spec; 27 tests | ✅ landed (lint blocked by the harness zone) |
| Harness lint zone fix (+ removed an eslint-disable) | builder · sonnet | ~22:08 | | ~22:09 | `eslint.config.js` | ✅ |
| Wave 2 gate by the coordinator | coordinator | ~22:09 | | 22:12 | — | ✅ typecheck, lint, format, 253/253 unit, e2e 18/18 (customer, seller, kit, hello × 3 projects); captures looked at |
| 3.5 Routing (react-router), shell, store wiring, URL filters, dedupe, remove hello, ConfirmButton tone, harness dev-only, order-flow e2e | builder · sonnet | 22:13 | ~22:45 | | `src/app/`, `src/components/`, `shared/dates.ts`, `e2e/`; hello removed; react-router 8.4.0 | ✅ landed ~22:18 |
| 3.5 gate by the coordinator | coordinator | ~22:18 | | 22:21 | — | ✅ typecheck, lint, format, 252/252 unit, full e2e 19 passed + 2 skipped by design; lockfile: react-router only; no server left running; flow captures looked at |
| Theme round 2: B Clay, C Sogan (batik brown), D Nila & Kunyit (indigo + turmeric), optional batik motif in the banner | builder · sonnet | 22:40 | ~23:00 | | `docs/design/mockups/batch-1-directions-2.html` (+461 lines, generated by `scratch/gen-directions2.mjs`) | ✅ owner picked C Sogan (D-025); 15 Sogan pairs re-checked by the coordinator, all pass |
| Extract the owner's reference prototype ("Delave weekly orders" artifact) into one staging file | Explore-style reader · haiku | 22:46 | ~23:00 | | `docs/design/reference/delave-prototype-extract.md` (484 lines) | ✅ landed; reconciliation in `docs/plan/reference-reconciliation.md`, waiting for the owner |
| 3.6 Reference palette (with AA fixes), "Delave", cut-off 9 pm, "N left" ≤ 5 | builder · sonnet | 22:53 | ~23:15 | | `src/theme/`, fixture, limits, item row + basket; tests 252 → 286 | ✅ landed ~22:56; coordinator re-ran the gate 22:57: 286/286 unit, e2e 19 + 2 skipped; seller list capture looked at |

## Phase 3 · Prototype, batch 2 (round 4) — 2026-10-08

Stage table in [roadmap.md](roadmap.md#phase-3--batch-2-after-ordering-stage-table). Plan approved (Q26 "A"). Starting point: owner's commit 3d48186 (clean tree).

| item | agent · tier | started | ETA | landed | diff | state |
|---|---|---|---|---|---|---|
| 4.1 Domain + mock API: lock, WhatsApp received, returning, changed + diff, inbox, nudge, seller-entered options, settings, ordering open/closed, customer vs seller views, tokens batch | builder · sonnet | 20:50 | ~21:30 | | `shared/`, `worker/`, `mocks/`, `src/api/`; tests 286 → 330 | ✅ landed ~20:58; coordinator gate first failed on format (26 files had CRLF), fixed, then green 21:00: 330/330, e2e 19 + 2 skipped |
| Fix: public menu leaks chef data (D-012) + seller-only menu endpoint | builder · sonnet | 21:02 | ~21:20 | ~21:03 | `shared/`, `worker/`, `src/api/`; tests 330 → 340 | ✅ coordinator gate 21:03: 340/340 |
| `.gitattributes` `* text=auto eol=lf` (D-029) | coordinator | 21:02 | | 21:02 | 1 file | ✅ (config, not product code) |
| 4.2 Customer: My orders, order page, change/cancel, How it works, closed state, returning (wave) | builder · sonnet | 21:04 | ~21:45 | ~21:19 | `customer-orders/` (new), `customer-menu/` changed, `src/api/device/` (new); 105 tests | ✅ landed; note: ran one `git mv` (rename is staged in the index, nothing committed); "open by code" only finds codes saved on this phone |
| Wave gate by the coordinator | coordinator | 21:19 | | 21:21 | — | ✅ no CRLF; typecheck, lint, format, **467/467** unit; e2e 25 passed + 2 skipped, then the settings spec alone 9/9; no server left running; captures looked at (locked order page, cook list by chef) |
| 4.3a Seller orders: markers, Changed filter, banners, nudge, lock, seen, + New order → send link (wave) | builder · sonnet | 21:04 | ~21:45 | ~21:14 | `seller-orders/` +4 files, ~13 changed; 46 tests | ✅ landed (waiting for the wave gate); 4.4 must pass `onNewOrder` |
| 4.3b Seller cook (group-by incl. chef, stats, notes), share post, minimal settings (wave) | builder · sonnet | 21:04 | ~21:45 | ~21:16 | `seller-cook/`, `seller-share/`, `seller-settings/` (new, ~27 files) + harness + e2e; 45 tests | ✅ landed (waiting for the wave gate); `formatPhone` duplicated in share/settings → move to `shared/phone.ts` in 4.4; its settings spec briefly closes ordering → gate runs it on its own |

| 4.4 Shell: routes for all batch 2 screens, store/i18n wiring, seller rail + list/detail at ≥ 820 px, light/dark/auto, `formatPhone` → shared, dev strings out of the build, Reset two-tap, batch2-flow e2e | builder · sonnet | 21:22 | ~22:00 | ~21:35 | `src/app/` (+SellerLayout), `src/components/` (+ThemeSwitch), theme preference, `shared/phone.ts`, `e2e/` (+batch2-flow, settings spec isolated in its own projects) | ✅ landed |
| 4.4 gate by the coordinator | coordinator | 21:35 | | 21:37 | — | ✅ typecheck, lint, format, **472/472** unit, full e2e **36 passed + 6 skipped by design**; desktop split capture looked at; the server on 5173 is the owner's (started 20:47), left running |
| 4.5 Polish: filter chips wrap + wider list pane (owner: "you have to scroll on the All – Cancelled filters"), action verbs on next-step buttons, banner text once, one language switch / one main, unused keys, flaky New-order spec | builder · sonnet | 21:42 | ~22:05 | ~21:53 | `src/app/`, `seller-orders/`, specs; tests 472 → 483 | ✅ coordinator gate 21:55: 483/483, e2e 36 + 6 skipped; 1024 px capture looked at (all 7 chips visible, "Confirm order", banner text once) |
| Desktop seller mock-up: A1 table + slide-over vs A2 three columns, plus cook list and empty state; low-tech-literacy rules (D-030) | builder · sonnet | 21:53 | ~22:15 | | `docs/design/mockups/seller-desktop.html` (274 lines) | ✅ owner picked A1 + "Next order" (D-031) |
| 4.6 Desktop seller layout A1: table, slide-over with Next/Previous order, desktop cook list with inline names, empty state, rail language switch (≥ 1024 px; phones unchanged) | builder · sonnet | 21:58 | ~22:30 | ~22:17 | `src/ui/` (+Table, SlideOver, Icon), `seller-orders/` (+table, panel), `seller-cook/` desktop, `src/app/`; tests 483 → 504 | ✅ coordinator gate 22:19: 504/504, e2e 36 + 6 skipped; table capture looked at (names truncate → fixed in 4.7) |
| 4.7 Collapsible rail (D-032), equal-width cook chips (D-033), no truncated names in the table | builder · sonnet | 22:20 | ~22:45 | ~22:31 | `src/ui/` (+Tooltip), `src/app/` (+railPreference), cook chips, table sizing; tests 504 → 509 | ✅ coordinator gate 22:33: 509/509, e2e 37 + 8 skipped; cook chips capture looked at |
| 4.8 Banner image slots (rail, desktop banner, phone banner; samples from OndeOnde1.png) | builder · sonnet | 22:34 | ~23:00 | ~22:45 | `src/ui/ImageSlot`, `shared/kitchenImages`, `SellerLayout`, `public/samples/` (untracked); tests 509 → 521 | ✅ coordinator gate 22:47: 521/521, e2e 38 + 10 skipped. Owner: banner crops badly → 4.9 |
| 4.9 No-crop banners (contain + per-seller background colour), rail 2:1 image + initial fallback, sizes per D-038, table fits at 1024 px | builder · sonnet | 22:48 | ~23:15 | | `src/ui/` (ImageSlot contain, Table, Pill), `src/app/`, `shared/`, fixture, samples (+rail.jpg); bg `#835937`; tests 521 → 529 | ✅ landed ~23:00; coordinator gate 23:01: unit 529/529, e2e 35 passed + **1 failed** (seller-batch2 "Starts as Confirmed", 3rd time) → root cause found; 1366 capture looked at (banner whole, brown sides, logo in rail) |
| Fix e2e flake: specs order the limited Lemper (20) across 3 projects in one run → sells out; move specs to unlimited items, one serial limits test, 3 green runs | builder · sonnet | 23:03 | ~23:20 | | `e2e/` (+limits.spec), `playwright.config.ts` (limits project, timeout 60 s) | ✅ landed ~23:25 (3 green runs by the builder) — but coordinator run 23:28: **1 failed again** (seller-batch2) → stock was NOT the root cause |
| Diagnose the real cause: New order form found **reset** (name empty, steppers 0) at failure → likely a dev-server reload or a remount; fix the root cause, reconsider the 60 s timeout | builder · sonnet | 23:30 | ~23:55 | | `src/app/SellerLayout.tsx` only | ✅ **root cause:** SellerLayout swapped its whole tree when the 1024 px media query flipped (Playwright full-page screenshots briefly report a 1×1 viewport) → the New order screen remounted and lost its form. A real bug: a tablet rotation or window resize would wipe a half-typed order. Fixed with one stable shell. Builder: 24/24 repeats, 3 green full runs; coordinator gate 00:13 (9 Oct): 529/529, e2e 40 passed + 12 skipped |
| 4.10 Native customer app (banner on top, EN/ID beside name, tabs Menu · My orders · Settings, Settings screen), owner's 5 images + background image, 2 owed fail-without-fix regression tests | builder · sonnet | 00:15 (9 Oct) | ~01:00 | | `src/app/CustomerShell.tsx` (new), `customer-settings/` (new), customer features, `public/samples/` (5 images, 448 KB total), e2e; tests 529 → 543 | ✅ stayed in its brief; both regression tests shown to fail without their fixes; coordinator gate 00:48: 543/543, e2e 42 passed + 13 skipped; iPhone menu capture looked at |
| 4.11 (first brief: headers without language switch) | builder · sonnet | 00:58 | | 00:59 | none (no files touched) | ⛔ stopped: owner amended D-042 ("keep the language switch") |
| 4.11 Customer sub-page headers: back + title + compact EN/ID (D-042 amended), `viewport-fit=cover`, drop unused `onMyOrders` | builder · sonnet | 01:00 | ~01:20 | | `src/ui/PageHeader` (new), customer screens, `index.html`; tests 543 → 552 | ✅ coordinator gate 01:15: 552/552, e2e 42 + 13 skipped; iPhone basket capture looked at |
| 5.1 Multi-seller domain + mock (seller id everywhere, slug rules, isolation tests, two sample sellers) | builder · sonnet | 01:17 | ~02:00 | ~01:35 | `shared/` (+seller.ts), `worker/mock/`, `mocks/` (+multiSeller.test), `src/api/`; compile fixes in 5 src files; tests 552 → 601 | ✅ coordinator gate 01:38 (unit only, by design): 601/601; mock still tree-shaken; e2e expected broken until 5.2 |
| 5.2 Multi-seller app: `/:slug` routes, Delave home, Menu-tab memory, My orders across sellers, dev seller picker, all e2e back to green + multi-seller spec | builder · sonnet | 01:39 | ~02:30 | | `src/app/`, `src/api/device/` (+sellerContext, lastKitchen), `src/components/SellerPicker` (dev only), features wiring, e2e (+multi-seller.spec); tests 601 → 619 | ✅ builder: 2 of 3 full runs green (1 webkit timeout); coordinator gate 02:19: 619/619, e2e **43 passed + 15 skipped**; My orders across sellers capture looked at |

**Checkpoint:** after the 6.2 wave, `scratch/checkpoints/post-wave6.tar` (03:45). After 6.1, `scratch/checkpoints/post-6.1.tar` (03:10; `git status` on src/features + e2e clean before the wave). Before 5.2, `scratch/checkpoints/pre-5.2.tar` (01:38). Before 5.1, `scratch/checkpoints/pre-5.1.tar` (01:16). Before 4.11, `scratch/checkpoints/pre-4.11.tar` (00:58). Before 4.10, `scratch/checkpoints/pre-4.10.tar` (00:14, 9 Oct). Before 4.6, `scratch/checkpoints/pre-4.6.tar` (21:57). After the wave, `scratch/checkpoints/post-wave4.tar` (21:21). After 4.1 + chef fix, `scratch/checkpoints/post-4.1-chef.tar` (21:03). `git status` checked before the wave: only the known 4.1 compile fixes in `src/features`.

## Phase 3 · Batch 3 (round 5) — 2026-10-09

Stage table in [roadmap.md](roadmap.md#phase-3--batch-3-seller-setup-stage-table). Plan approved (D-043). Starting point: owner's commit 528d926 (clean tree); snapshot `scratch/checkpoints/pre-6.1.tar` (02:34).

| item | agent · tier | started | ETA | landed | diff | state |
|---|---|---|---|---|---|---|
| 6.1 Domain + mock: weeks, menu items (D-020), chefs, saved sets, 5-slot image upload, past weeks + retention, backup/CSV, paste-a-post parser | builder · sonnet | 02:35 | ~03:30 | | `shared/` (+imageSlots, pastePost, pastWeeks, csv, backup, setupContract), `worker/mock/`, `src/api/` (+27 client fns); tests 619 → 691 | ✅ landed ~03:05; coordinator gate 03:10: unit 691/691; e2e 38 passed, **1 failed** (mobile-webkit `order-flow` `page.reload()` hang — the known webkit issue, not 6.1), 4 did not run |
| 6.2a Menu editor: items table/editor (D-020 delete rule → sold out), publish, reorder, saved sets, paste-a-post, preview callback (wave) | builder · sonnet | 03:12 | ~04:00 | | `seller-menu/` (new) + harness + e2e; 48 tests | ✅ landed ~03:35 |
| Wave 6.2 gate by the coordinator | coordinator | 03:36 | | 03:44 | — | ❌ unit 782/785 (3 timeouts/flakes under load in seller-history + seller-settings tests); e2e 48 passed, **6 failed** (4 mobile-webkit hangs + seller-menu paste locator bug), suite 4.9 min |
| Test reliability: webkit hang root cause, Playwright workers/order, unit timeouts, paste locator; 3 green runs each | builder · sonnet | 03:46 | ~04:30 | ~04:35 | `vitest.config.ts` (maxWorkers 4), `playwright.config.ts` (30 s timeout again, webkit after chromium, seller-menu isolated, duplicate `limits` project removed), `e2e/seller-menu.spec.ts` | ✅ root cause = CPU starvation from the stuck python processes; no app bug; unit 785 × 3 (~26 s), e2e 58 × 3 (~62 s) |
| Coordinator: stale edits from the killed processes | coordinator | 04:36 | | 04:38 | `shared/domain.ts` (duplicate `bannerBackgroundImage` field), `e2e/sellerHelpers.ts` (duplicate comment) restored from the 03:45 snapshot | ✅ when the stuck processes were killed at 04:12, their waiting scripts resumed and re-applied old edits to 4 files; 2 had real duplicates |
| Gate (quality + changed specs only) | coordinator | 04:38 | | 04:39 | — | ✅ no stray processes; unit **785/785** (23.6 s); e2e changed specs 58 passed, 27 skipped |
| D-044 archived orders readable read-only for 4 weeks, then "archived" | builder · sonnet | 04:40 | ~05:20 | | `shared/`, `worker/mock/`, `src/api/`, `customer-orders/`, e2e spec; tests 785 → 818 | ✅ landed ~04:46 (waiting for the gate). Expired orders keep a tiny `{token, cookingDate, seller}` summary for good (no personal data). Its e2e spec closes a week and resets the mock → needs its own Playwright project after `limits` (config change pending) |
| 6.3 Batch 3 shell: routes, Menu tab, More page, Preview as customer (D-019), i18n/store wiring | builder · sonnet | 04:40 | ~05:20 | | `src/app/` (+SellerPreview), `src/main.tsx`, `src/i18n/`, `customer-menu/MenuScreen` (preview prop), e2e (+seller-batch3) | ✅ landed ~04:48; unit 818 |
| 6.4 Final fix-up: Playwright isolation (seller-batch3 serial, archived-orders last), export `opRequested`, single title on More sub-pages, run the changed specs | builder · sonnet | ~04:49 | ~05:10 | ~04:52 | `playwright.config.ts` (+archived-desktop-chromium project), `seller-menu/index.ts`, `SellerPreview`, `PageHeader` (`titleHidden`), `AppRoutes` | ✅ |
| Final gate of the day | coordinator | 04:52 | | 04:54 | — | ✅ no stray processes before or after; no CRLF; typecheck, lint, format, unit **818/818**; changed specs: main 4 passed (batch2-flow, banners), settings-mobile 4, settings-desktop 4 (seller-batch3, seller-menu; serial projects must run one at a time), archived 1; preview capture looked at |

Note: the times written at 04:46–05:12 for D-044, 6.3 and 6.4 ran ahead of the PC clock (lesson 2 again); corrected at 04:55.
| 6.2b Seller setup: week settings, images editor (5 slots, client resize, live preview, colour, alt), chefs (wave) | builder · sonnet | 03:12 | ~04:00 | | `seller-setup/` (new, ~19 files) + harness + e2e; 23 tests | ✅ landed ~03:25 (waiting for the wave gate); added a rule: cut-off not after cooking date |
| 6.2c Labels (A4 2×7 / 62 mm, note ≤ 70) + past weeks + backup/CSV/restore (wave) | builder · sonnet | 03:12 | ~04:00 | | `seller-labels/`, `seller-history/` (new) + harness + e2e; 23 tests | ✅ landed ~03:30 (waiting for the wave gate); no store/saga (local state); native checkbox (kit has none); roll label 62 × 40 mm assumed |

## Findings

- **Batch 3 polish list** (coordinator, preview capture 04:54; low): preview steppers look enabled even though ordering is off; "Delivery available: Pickup only" reads oddly; the seller's WhatsApp number shows raw (`+61400000002`) in "How ordering works"; items without a size show a leading "· $9.00"; e2e leaves "B3 dish"/"Spec dish" items in Dapur Demo's in-memory menu (gone on server restart).

- **Eight stuck `python -` processes at 100% CPU since 22:00** (critical; found 04:11 after the owner reported ~6 h of 100% CPU): `python`/`python3` launched with a bash heredoc (`python - <<'X'`) through the Windows Store launcher sometimes never sees end-of-input and spins. Started by this session (coordinator doc edits and/or builders — start times match rounds from 22:00 to 03:14). All stopped by PID at 04:12; a ninth, from the coordinator's own command at 04:12, stopped too. **Likely the main cause of the webkit hangs and unit timeouts since ~22:00.** The reliability builder was told to re-measure. From now on: no `python` heredocs on this PC (use the Edit tool or Node scripts), and every gate starts with a stray-process check.


- **Test suite no longer reliable under its own load** (high, 03:44): 785 unit tests and ~50 e2e tests across 3 browser projects saturate the PC — unit timeouts and mobile-webkit hangs. Reliability round running before anything else lands.

- **Mobile-webkit `page.reload()` hang** (medium → now blocking gates): third occurrence (order-flow, 03:10). Fix right after the 6.2 wave (playwright config/specs only), before 6.3.
- **Archived orders become unreachable** (6.1 builder): closing a week removes its orders from the live list, so customers' My-orders links 404. Ruled D-044 — owner switched to **A**: readable read-only by link for 4 weeks, then "archived"; built after the wave with the webkit fix.
- ~~Mobile-webkit slowness~~ (merged above) (medium): full suite now ~2.9 min; webkit specs take 20–70 s and one timed out once in 5.2 (WhatsApp button not stable within 60 s). Next step: run fewer projects in parallel (`workers`) or split webkit into its own run, then put the timeout back to 30 s.
- **Returning-customer edge** (low): an old My-orders entry without a seller counts as "returning" for every seller until it is migrated on next fetch.

- **4.10 follow-ups** (00:48): (1) `index.html` lacks `viewport-fit=cover`, so safe-area padding is 0 on real iPhones; (2) harness still passes the unused `onMyOrders` → drop the prop; (3) sub-page top bars → ruled D-042, in 4.11; (4) the sample kitchen is named "Delave" (the app) while its banner says "Onde Onde" → fixed by the multi-seller fixtures in 5.1.
- **Load-related slowness** (low): one vitest timeout in `desktop.test.tsx` and one webkit reload hang while the machine was busy; both passed on rerun.

- **Phone order list scrolls sideways at 390 px with 30-character names without spaces** (4.9 builder; low — real names have spaces). Fix with `overflow-wrap: anywhere` on the name in `OrderRow`.

- **Owner's new banner `imgs/ondeondelarge.png`** (2161 × 728, ≈ 3:1, 22:57) — wider than the first sample but not the 5:1 of D-038; shown whole it would be ~385 px tall on a tablet. Superseded by D-040: the owner made the full D-038 set + a blurred 2560×512 background; swap in 4.10.

- **Customer app should feel native** (owner screenshot, 22:55): banner at the very top; no "My orders" link or EN/ID bar above it; language under the banner and name, or in a settings tab; a bottom tab bar. Ruled D-039 (tabs Menu · My orders · Settings; EN/ID toggle beside the name too); built as 4.10 after 4.9.

- **Orders table overflows at 1024 px with long names** (4.8 builder): reached 1055 px; fix in 4.9.
- ~~**`seller-batch2` flaky**~~ — fixed 9 Oct 00:10: layout remount on media-query flip (see the round above). Still owed: a regression test that fails without the fix (in 4.10).
- **Webkit hang on "Change or cancel order"** (low, seen once by the diagnosis builder in `batch2-flow` on mobile-webkit) — watch.
- **Playwright timeout 60 s** kept: `order-flow` on mobile-webkit takes ~47 s with three projects in parallel.
- ~~`seller-batch2` flaky again~~ (4.8 builder: "Starts as Confirmed" not found once under load, passed alone). Watch; if it recurs, give it its own serial project like the settings spec.

- **Seller banner crops badly** (owner screenshot, 22:40): the 2.5:1 image in a height-capped strip with object-fit cover cuts off faces and the logo. Owner will generate a separate image per slot; seller target is a **tablet in landscape**; on wider desktops the banner should sit centred with a nice background colour filling the sides. Sizes ruled D-038; 4.9 running.

- **Multi-seller** ruled D-036 (one app, many sellers, each with its own id/key). Plan a foundation stage before batch 3; customer link format = question 35.

- **Banner image slots** (owner, 22:25, D-034): rail + main-body placeholders on seller, one on top for customers; empty containers for now; extended by D-035 (3 image slots per seller; owner's sample banner `imgs/OndeOnde1.png`); 4.8 starting.

- **Collapsible left navigation** (owner, ~22:00: "like in Microsoft DevOps"): queued for after 4.6 (4.6 owns the rail; no mid-task changes). Ruled D-032 (icons only, labels on hover/focus; exception to D-030).
- **Cook list: names and amounts aren't clear** (owner, 22:15). Ruled D-033 (equal-width chips "Rina × 2"); built with D-032 after 4.6.

- **Desktop seller layout feels like a phone screen stretched** (owner, 21:50): "a lot of spacing … rearrange to not look like a mobile display on desktop". Owner ruled D-030 (mock up A, keep it simple for low tech literacy); mock-up running.

- ~~**Batch 2 polish list**~~ (fixed in 4.5, 21:53; flaky spec passed in 3 full runs since) (found by the coordinator in the desktop split capture, 21:37): (1) the next-step button shows the target status ("Confirmed", "Collected") instead of an action ("Confirm order", "Mark collected"); (2) the New customer banner repeats "New customer" twice; (3) the status filter row is clipped in the narrow list pane (scrolls sideways); (4) two EN/ID switches and two `<main>` landmarks on desktop split; (5) unused `tabs.*` keys in seller-orders i18n; (6) one flaky `seller-batch2` desktop run (New order quantities lost once; 4 reruns + 2 full suites passed) — watch.
- **Docs had CRLF** (low): five coordinator docs had picked up CRLF; normalised at 21:38 (`.gitattributes` also normalises them on commit).

- ~~**Public menu leaks chef names**~~ (fixed 21:03; a test asserts the raw public menu has no "chef" text).
- **CRLF line endings after a builder used `git stash`** (medium): `core.autocrlf=true` on this PC, so a git checkout/stash rewrites files with CRLF and Prettier fails. The 4.1 report said format passed; the gate found 26 CRLF files. The coordinator normalised them to LF (mechanical, no content change). Fix: briefs now forbid stash/checkout/reset; a `.gitattributes` with `eol=lf` needs the owner's OK.

- **Dev leftovers in the client bundle** (low): the `devSampleOrdersRequested` action name and `/api/dev/...` URL strings still ship (the server side is tree-shaken, so they do nothing in production). Fix: gate the dev client calls on `import.meta.env.DEV` too.
- **Dev "Reset" has no second tap** (low, dev only): one tap wipes the mock store. Fix: use ConfirmButton.

- ~~For 3.5, consolidate duplicates~~ (done in 3.5): two `dates.ts` (customer, seller) and three language switches (hello, customer layout, seller harness) → one each in `src/components/`.
- **Kit lacks a link-styled button** (low): the WhatsApp action uses `window.open` from a Button; add a kit `ButtonLink` later.

- ~~Harness lint zone too narrow~~ (fixed ~22:09; coordinator's brief error): `src/harness` may import only ui/theme, but feature harnesses need features, i18n and api. Fix after wave 2: allow harness → features/i18n/api/ui/theme and forbid anything importing `src/harness` except `src/main.tsx`.
- ~~For 3.5~~ (done): move the seller list filter/search to the URL; call `registerSellerI18n()` (and the customer equivalent) after `initI18n()`; tab bar links are inert until routing.

- **WhatsApp link has no seller number** (open, for later): "Send to seller on WhatsApp" needs the seller's WhatsApp number to open her chat directly; without it `wa.me/?text=` makes the customer pick the chat. The prototype uses the picker; ask the owner whether the kitchen settings should hold the seller's own WhatsApp number (it's the seller's, not a customer's, and already public in the group).

- ~~ConfirmButton armed state is green~~ (fixed in 3.5): "Tap again to cancel" turns primary green, which reads as a go action for a destructive step. Fix: armed state uses the cancelled tone (text + tint). Do in 3.5.

- ~~New px rule flags the hello screen~~ (fixed ~21:56): `HelloScreen.tsx` and `LanguageSwitch.tsx` use literal `1px` borders; fix with `theme.border.hairline` (the hello screen is removed in 3.5 anyway, but the gate must be green now).
- ~~Kit harness not gated to dev~~ (fixed in 3.5) (low, coordinator default): `?harness=kit` ships in the build; gate it on `import.meta.env.DEV` in 3.5.

- **Wrong weekdays in the sample week** (medium, coordinator's own error, caught by the 3.2 builder): the wireframe and mock briefs used "Sat 11 Oct / Fri 10 Oct", but in 2026 Saturday is 10 Oct and Friday 9 Oct. Fix: the fixture is being corrected now; the wireframes (docs) still say 11/10 Oct and will be corrected in a later docs pass.
- ~~Seller actions after the cut-off~~: ruled in D-024 (only customers are locked out).

- **Seller tab bar differs between batches** (low): batches 1–3 use Orders · Cook list · Menu · More; batch 4's S13 uses Orders · Cook list · Hand-over · More. Coordinator's default (overrulable): seller gets 5 tabs, Orders · Cook list · Hand-over · Menu · More; chefs get the same without Menu. Applied in the styled mock-ups (phase 3), wireframes left as drawn.

- ~~Batch 2 content mismatches~~: fixed (Lemper 17 of 20; earlier order G3W-8RT); checked by the coordinator.

- ~~Batch 1 wireframe content mismatches~~: fixed in draft 2 (one $30.00 order through the flow, S2 Confirmed, language EN); checked by the coordinator.

- **TypeScript 6.0.3, not 7** (low): typescript-eslint 8.71 doesn't support TS 7 yet (upstream issue targets TS 7.1). Fix: upgrade when typescript-eslint supports it.
- **7 helper dev packages outside the approved list** (approved, [D-016](../decisions/README.md)): @vitejs/plugin-react, @testing-library/dom, @eslint/js, globals, @types/react, @types/react-dom, @types/node.
- **Folder deviation** (accepted): i18n setup is in `src/i18n/init.ts` and the theme provider in `src/theme/`, not `src/app/`, because features may not import `app`. `LanguageSwitch` sits in `features/hello/` until a second screen needs it, then moves to `components/`.
- **Not yet enforced** (D-006): a lint rule blocking literal values inside styled blocks. Add with the UI kit in phase 3.
- `pnpm-workspace.yaml` exists only to allow install scripts for esbuild, workerd and unrs-resolver (pnpm blocks them by default).

## Start here (next session)

**Where things stand (9 Oct 2026, 04:55):** phases 0–2 done; phase 3 prototype has batches 1–3 clickable on mock data — customer app (native tabs), seller desktop/phone, multi-seller (`/onde-onde`, `/dapur-demo`), owner's Onde Onde images, menu editor, seller setup + images editor, labels, past weeks, backup, archived orders (D-044). Decisions D-001…D-044. Last owner commit: `528d926`; batch 3 work is uncommitted (message drafted in `scratch/commit-message.txt`). Gate at 04:54: typecheck, lint, format, unit **818/818**, changed e2e specs green.

**Next:** (1) owner commits batch 3; (2) small polish round from the Findings list (preview steppers look enabled, "Delivery available: Pickup only" wording, raw `+614…` number on the menu, leading "·" when an item has no size, test items left in Dapur Demo); (3) **batch 4** stage table for approval — sign-in screens (D-011 passkeys + password fallback, D-013 chefs), admin page that creates sellers and slugs (D-036/D-037), invite keys, scan to collect, hand-over, delivery run, bulk updates; (4) phase 4 real backend.

**Before any work:** read [lessons.md](lessons.md) (esp. 2, 10, 11) and the memory notes. Machine rules: no `python` heredocs, no `cd && write`, check for stray processes before every gate, gate = changed specs only (full suite only when the owner asks), read the clock before writing times.

Ready prompt: "Read docs/plan/board.md (Start here) and docs/plan/lessons.md, then continue from Next."
