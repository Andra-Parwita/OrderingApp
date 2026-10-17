# 091 · Faster lint, Prettier and tests

**Status:** analysis done 17 Oct (read-only); measure after the 1.0.38 gate, then build. Owner: "check how we can optimise linter, prettier and tooling to make it faster".

## Already in place
ESLint 10 + typescript-eslint (type-aware, projectService) + import-x (no-cycle, no-restricted-paths), no cache. `.gitattributes` `* text=auto eol=lf` and Prettier `endOfLine: lf` exist; agent-created files still land as CRLF until renormalised. `tsc -b` is already incremental (3 projects). Vitest 5, maxWorkers 4, one setup, 199 files, Miniflare/D1-backed tests cause Windows port flakes. Playwright: one shared server/DB, ~16 chained projects by file-name regex, a serial tail.

## Proposed changes
| change | tool | expected gain | effort | owner OK? |
|---|---|---|---|---|
| `--cache --cache-strategy content` | ESLint | warm runs: minutes → seconds | 5 min | no |
| move `import-x/no-cycle` to a gate-only cycles config | ESLint | often the biggest lint cost (measure with `TIMING=1`) | 30 min | no |
| `--concurrency 4` (measure memory) | ESLint | maybe 2–3× cold | 15 min to measure | no |
| lint / Prettier only changed files for daily checks | both | seconds | 15 min | no |
| `prettier --cache` | Prettier | warm runs: tens of seconds → seconds | 5 min | no |
| `.editorconfig` (LF) + one-time `git add --renormalize .` in its own commit | git | stops CRLF format failures | 10 min | **yes (git)** |
| Vitest split: fast jsdom/pure group (4–6 workers) and D1/Miniflare group (2 workers, forks); OS-assigned ports + keep-alive | Vitest | no more "fetch failed" re-runs; fast group ~1 min | 1–2 h | no |
| `vitest --changed` / `related` daily | Vitest | seconds–1 min | 5 min | no |
| tag the two ~5-min design-compare specs `@design` and skip them by default | Playwright | up to ~10 min off the full suite | 30 min | **yes (default)** |
| set `workers` explicitly, `reporter: dot` locally (measure 4/6/8) | Playwright | small | 30 min | no |
| scripts: `check:fast` (changed files, < 1–2 min) and `check:full` (the gate) | all | daily speed | 30 min | no |
Not recommended: Playwright sharding (one shared server/DB), reusing the e2e server (seed is destructive).

## Measure first (idle PC, after the gate)
`TIMING=1 eslint .` (with and without no-cycle, peak memory); `--concurrency 4`; warm-cache lint; `tsc -b --extendedDiagnostics`; Prettier cold/warm; Vitest with maxWorkers 2/4/6 and flake count; Playwright per-project/spec durations (JSON reporter); CRLF count (`git ls-files --eol`).
