# Board

Live status of the current round. The plan itself (phases, stage tables, folder structure) is in [roadmap.md](roadmap.md); rulings are in [decisions](../decisions/README.md). Times are real clock times (AEDT, Sydney).

## Summary

| phase | state | next |
|---|---|---|
| 0 · Plan | ✅ done 2026-10-07 (D-003 to D-015) | — |
| 1 · Scaffold | ✅ landed ~20:24, gate verified by the coordinator | owner: open the hello screen on a phone |
| 2 · Wireframes | ✅ batches 1–3 approved · 👀 batch 4 waiting for review | then phase 3: styled mock-ups → clickable prototype |
| 3–5 | ⏳ not started | — |

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

**Checkpoints:** before phase 1, the uncommitted docs were snapshotted to `scratch/checkpoints/pre-phase1-docs.tar` (20:20).

## Phase 2 · Wireframes (round 2)

Batches in [D-017](../decisions/README.md): 1 core loop · 2 after ordering · 3 seller setup (incl. banner editor) · 4 sign-in and Saturday.

| item | agent · tier | started | ETA | landed | diff | state |
|---|---|---|---|---|---|---|
| Batch 1: C1 menu (EN + ID), C2 basket/checkout, C3 order placed + WhatsApp text, S1 order list, S2 order detail | builder · sonnet | 20:40 | ~21:10 | ~20:45 | `docs/design/wireframes/batch-1.html` (+297 lines) | ✅ approved with changes (D-018) |
| Batch 1 fixes: 3 content mismatches + order notes (D-018) | builder · sonnet | 20:55 | ~21:10 | ~21:00 | `batch-1.html` (draft 2) | ✅ approved |
| Batch 2: C4 My orders, C5 order page (before cut-off + Ready), S3 add order for WhatsApp customer (+ link sent), S4 cook list by chef, S5 WhatsApp post | builder · sonnet | 21:05 | ~21:20 | ~21:12 | `docs/design/wireframes/batch-2.html` (+387 lines) | ✅ approved |
| Batch 2 fixes (2 mismatches) + batch 3: S6 menu, S7 item editor, S8 saved sets, S9 week settings, S10 banner, S11 chefs and people, S12 labels | builder · sonnet | 21:20 | ~21:40 | ~21:30 | `batch-2.html` (draft 2), `batch-3.html` (+400 lines) | ✅ approved with a change (D-019) |
| Batch 3 change: "Preview as customer" on S6 + new frame S6b (D-019) | builder · sonnet | 21:40 | ~21:50 | ~21:45 | `batch-3.html` (draft 2) | ✅ landed; S9 pill set to Draft by the coordinator |
| Batch 4: A1 invite key, A2 passkey help, A2b password fallback, A3 sign in, A4 admin page, A4b admin first setup, C6/C6b scan to collect, S13 seller hand-over, S13b delivery run | builder · sonnet | 21:55 | ~22:15 | ~22:02 | `docs/design/wireframes/batch-4.html` (+438 lines) | 👀 owner review |

## Findings

- **Seller tab bar differs between batches** (low): batches 1–3 use Orders · Cook list · Menu · More; batch 4's S13 uses Orders · Cook list · Hand-over · More. Coordinator's default (overrulable): seller gets 5 tabs, Orders · Cook list · Hand-over · Menu · More; chefs get the same without Menu. Applied in the styled mock-ups (phase 3), wireframes left as drawn.

- ~~Batch 2 content mismatches~~: fixed (Lemper 17 of 20; earlier order G3W-8RT); checked by the coordinator.

- ~~Batch 1 wireframe content mismatches~~: fixed in draft 2 (one $30.00 order through the flow, S2 Confirmed, language EN); checked by the coordinator.

- **TypeScript 6.0.3, not 7** (low): typescript-eslint 8.71 doesn't support TS 7 yet (upstream issue targets TS 7.1). Fix: upgrade when typescript-eslint supports it.
- **7 helper dev packages outside the approved list** (approved, [D-016](../decisions/README.md)): @vitejs/plugin-react, @testing-library/dom, @eslint/js, globals, @types/react, @types/react-dom, @types/node.
- **Folder deviation** (accepted): i18n setup is in `src/i18n/init.ts` and the theme provider in `src/theme/`, not `src/app/`, because features may not import `app`. `LanguageSwitch` sits in `features/hello/` until a second screen needs it, then moves to `components/`.
- **Not yet enforced** (D-006): a lint rule blocking literal values inside styled blocks. Add with the UI kit in phase 3.
- `pnpm-workspace.yaml` exists only to allow install scripts for esbuild, workerd and unrs-resolver (pnpm blocks them by default).

## Start here (next session)

Phases 0 and 1 done (not committed), phase 2 (wireframes) next on branch `plan/flow-and-prototype` (nothing committed yet; commits are the owner's). Read this board, then [roadmap.md](roadmap.md). Ready prompt: "Read docs/plan/board.md and continue from the next item."
