# Board

Live status of the current round. The plan itself (phases, stage tables, folder structure) is in [roadmap.md](roadmap.md); rulings are in [decisions](../decisions/README.md). Times are real clock times (AEDT, Sydney).

## Summary

| phase | state | next |
|---|---|---|
| 0 · Plan | ✅ done 2026-10-07 (D-003 to D-015) | — |
| 1 · Scaffold | ✅ landed ~20:24, gate verified by the coordinator | owner: open the hello screen on a phone |
| 2 · Wireframes | ⏳ not started | first batch of screens after phase 1 lands |
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

## Findings

- **TypeScript 6.0.3, not 7** (low): typescript-eslint 8.71 doesn't support TS 7 yet (upstream issue targets TS 7.1). Fix: upgrade when typescript-eslint supports it.
- **7 helper dev packages outside the approved list** (approved, [D-016](../decisions/README.md)): @vitejs/plugin-react, @testing-library/dom, @eslint/js, globals, @types/react, @types/react-dom, @types/node.
- **Folder deviation** (accepted): i18n setup is in `src/i18n/init.ts` and the theme provider in `src/theme/`, not `src/app/`, because features may not import `app`. `LanguageSwitch` sits in `features/hello/` until a second screen needs it, then moves to `components/`.
- **Not yet enforced** (D-006): a lint rule blocking literal values inside styled blocks. Add with the UI kit in phase 3.
- `pnpm-workspace.yaml` exists only to allow install scripts for esbuild, workerd and unrs-resolver (pnpm blocks them by default).

## Start here (next session)

Phases 0 and 1 done (not committed), phase 2 (wireframes) next on branch `plan/flow-and-prototype` (nothing committed yet; commits are the owner's). Read this board, then [roadmap.md](roadmap.md). Ready prompt: "Read docs/plan/board.md and continue from the next item."
