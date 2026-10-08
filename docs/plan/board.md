# Board

Live status of the current round. The plan itself (phases, stage tables, folder structure) is in [roadmap.md](roadmap.md); rulings are in [decisions](../decisions/README.md). Times are clock times on the dev PC. Note: phase 2 and stage 3.0 times above were estimated and run ahead of the real clock; from wave 1 on they are read from the PC clock.

## Summary

| phase | state | next |
|---|---|---|
| 0 · Plan | ✅ done 2026-10-07 (D-003 to D-015) | — |
| 1 · Scaffold | ✅ landed ~20:24, gate verified by the coordinator | owner: open the hello screen on a phone |
| 2 · Wireframes | ✅ done: batches 1–4 approved | — |
| 3 · Prototype (batch 1) | ✅ batch 1 clickable end to end (22:21) · 🔄 theme rethink (owner: Clay or a traditional Indonesian feel) | ✅ 3.6 reference palette live · batch 2 plan waiting for question 26 |
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

## Findings

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

Phases 0–2 done; phase 3 batch 1 clickable (not committed); next: owner tries it, then batch 2 on branch `plan/flow-and-prototype` (nothing committed yet; commits are the owner's). Read this board, then [roadmap.md](roadmap.md). Ready prompt: "Read docs/plan/board.md and continue from the next item."
