# 020 · App version on every deploy

**Status:** approved by the builder (2026-10-10, "A"; D-079). Built after the demo, with plans 018 and 019.
**Goal:** every build carries a version, so anyone can tell which version is live: `1.0.<build> · <commit>`. Example: `1.0.18 · c491a12`. "· draft" is added when the working tree has uncommitted changes.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Version at build time.** `package.json` `version` becomes `1.0.0`; only the major and minor parts are used, and they are raised by hand for big releases. At build, `vite.config.ts` computes `<major>.<minor>.<git rev-list --count HEAD>`, the short commit id (`git rev-parse --short HEAD`) and a draft flag (`git status --porcelain` not empty), and defines them for the client (`__APP_VERSION__`) and the Worker (same define, or a generated `shared/buildInfo.ts`). Without git (e.g. a CI tarball), it falls back to `<major>.<minor>.0 · unknown`. | `vite.config.ts`, `package.json`, `shared/` (types), `src/vite-env.d.ts` | a unit test of the formatting helper (count, commit, draft, no git) |
| 2 | **Shown where it matters.** `/api/health` adds `version`. Every app shows it (builder: "in all apps, seller and customer, we should show the version too"): the seller Settings footer, the admin home footer, the customer Settings footer and the customer About page (plan 019). Each shows it in small muted text. The deploy output prints it (`deploy` script: `pnpm build && node -e "…print version…" && wrangler deploy`, or the build log line). | `worker/api/index.ts` (health), `shared/health.ts`, `src/features/seller-settings/`, `src/features/admin/`, `package.json` scripts | tests: health has `version`; the Settings footer shows it |

## End of phase
- [ ] typecheck · lint · format · the touched unit tests · `pnpm build` shows the version line
