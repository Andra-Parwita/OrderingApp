# 045 · Releases run by GitHub, not by hand

**Status:** later (2026-10-11). Builder: "how can we automate deploy and not rely on you and me?", then "no need for release automation now, maybe in future". Kept as a ready plan; the choice below is still open.
**Goal:** pushing a version tag (`v1.0.25`) releases the app: checks, a backup of the live database, migrations, deploy and a health check, with no wrangler login on anyone's PC. Tonight's manual release (v1.0.24) is the model: backup → migrate → deploy → check `/api/health` → `main` + tag.

## Open choice (builder)

- **A (recommended):** GitHub Actions on a `v*` tag, with a GitHub "production" environment that needs one approval click (the owner) before anything touches the live app.
- **B:** the same, without the approval click: the tag alone releases.
- **C:** Cloudflare Workers Builds (dashboard Git integration, deploys on every push to `main`). No token needed, but no tests, no backup, and migrations need extra setup.

## Stages (for A or B)

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Owner setup (owner, in the dashboards; the plan lists the exact clicks).** Cloudflare (Iparwita account): an API token limited to *Workers Scripts: Edit*, *D1: Edit* and *Account Settings: Read*, scoped to that account. GitHub repo → Settings → Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. For A: Settings → Environments → `production` with the owner as required reviewer. | — | both secrets exist; a dry run of `wrangler whoami` in the workflow shows the Iparwita account |
| 2 | **Checks job** on the tag: `pnpm install --frozen-lockfile`, typecheck, lint, format:check, every unit test, build. Full git history (`fetch-depth: 0`), because the version number counts commits (D-079). | `.github/workflows/release.yml` | a tag on a branch with a failing test stops here |
| 3 | **Release job** (needs the checks; for A, waits for the approval): turn maintenance on (plan 046, if built) → `wrangler d1 export --remote` saved as a run artifact (30 days) → `wrangler d1 migrations apply --remote` → `wrangler deploy` → poll `/api/health` until it shows the tag's version (fail after 2 minutes) → maintenance off. Any failure leaves maintenance on and the run red. | `.github/workflows/release.yml` | a test tag on a copy releases end to end; the backup artifact downloads |
| 4 | **Runbook.** `docs/guide/deploy-cloudflare.md` gets "Release by tag" first and keeps the manual steps as the fallback; how to roll back (`wrangler rollback` + restoring the export); where the backups are. | `docs/guide/deploy-cloudflare.md` | the son and the owner can each release from their phone (tag via GitHub web) |

## End of phase

- [ ] one real release by tag (v1.0.25), checked on the live app

## Decisions and notes

- Playwright stays a local gate before tagging (too slow and flaky for every release on CI for now); revisit when the suite is stable on Linux.
- No secrets in the repo; the token never leaves GitHub Secrets.
