# Roadmap (high level)

**Status:** draft, 2026-10-07. Waiting on the owner's rulings (see "Questions" below).
**Goal:** build the weekly ordering app on Cloudflare (Workers, D1, Durable Objects, R2), proving the UI on this PC with mock data before any real backend work or deploy.
**Sources:** [concept brief](../../briefs/food-ordering-concept-brief.md) (behaviour), [tech-stack.md](../guide/tech-stack.md) (stack and gate), [design/README.md](../design/README.md) (style), [decisions](../decisions/README.md).

## Phases

Every phase runs on this PC first: `https://localhost` and phones on the home Wi-Fi ([D-002](../decisions/README.md)). `@cloudflare/vite-plugin` runs the Worker, D1 and Durable Objects locally (Miniflare), so phases 1 to 4 need no Cloudflare account. Phase 5 is the first time anything touches Cloudflare.

| # | phase | what | done when |
|---|---|---|---|
| 0 | **Plan** | this roadmap, the folder structure, the owner's rulings on open questions | rulings recorded in decisions; roadmap approved |
| 1 | **Scaffold** | tooling (Vite + React + TS strict, Redux Toolkit + saga, i18n, ESLint with no-cycle, Prettier, Vitest, Playwright, MSW), the empty folder skeleton, mkcert HTTPS, and a "hello" Worker endpoint | gate green; the hello screen opens on the PC and a phone over HTTPS |
| 2 | **Wireframes** | low-fidelity frames (layout and real content from the brief, greys only, no styling), customer and seller, a few screens per review ([D-005](../decisions/README.md)) | the owner approves the flow and layout of each batch |
| 3 | **Styled mock-ups → clickable prototype, mock data** | per batch: apply tokens and style to the approved wireframes, then build them in React on MSW mock data (the sample menu from the brief) with an "add sample orders" button; nothing stored on a server | each batch reviewed by the owner on the PC and a phone; at the end the full weekly cycle is clickable on both sides; specs green |
| 4 | **Real backend, still local** | D1 schema and migrations, Worker API with typed contracts, a Durable Object for the seller's live order list; MSW is swapped out for the real API in dev (kept for tests) | the same specs pass against the local Worker + D1 + DO |
| 5 | **Cloudflare** | deploy to `workers.dev` (the owner's step), then Web Push, R2 images, labels/QR, retention | the owner tests on Cloudflare from their phone |

Phases 1–4 each get a stage table (files owned, proof, estimate) before they start.

## Proposed folder structure

One package, client and Worker in the same Vite project (the layout `@cloudflare/vite-plugin` expects). Ruled in [D-003](../decisions/README.md).

```
src/                    React app (client)
  app/                  shell, routing, store, root saga
  features/             one folder per screen group, each owns its state + saga
    customer-menu/      menu, basket, checkout
    customer-orders/    my orders, order page, inbox, scan to collect
    seller-orders/      order list, cook totals, status updates
    seller-menu/        weekly menu, saved sets, share to WhatsApp
    seller-labels/      label printing
  components/           shared app components used by customer AND seller screens
                        (order row, status pill, price, item line, language switch)
  ui/                   UI kit: generic controls (button, input, list row, dialog,
                        tabs, toast); screens build only from these
  theme/                design tokens (colour, spacing, type, radius, motion),
                        light + dark, global styles; the only place values live
  api/                  typed API client (the only place that calls fetch)
  i18n/                 en.json, id.json, init.ts (setup; features may import it)
worker/                 Cloudflare Worker
  index.ts              entry + router
  routes/               one file per endpoint group
  db/                   D1 queries
  live/                 Durable Object: live updates to seller devices
  push/                 Web Push (phase 5)
shared/                 contracts, types and pure helpers used by both sides
                        (order code, money, statuses); no React, no Worker APIs
migrations/             D1 SQL migrations
mocks/                  MSW handlers + fixtures (prototype and tests)
e2e/                    Playwright specs + harness routes
public/                 web manifest, icons, service worker
```

Import rule (lint-enforced, no cycles): `app → features → components → ui → theme`; anything may import `shared/`; `shared/` imports nothing from the app or the Worker; `src/` and `worker/` never import each other.

## Questions for the owner

Asked one at a time; each answer goes into [decisions](../decisions/README.md).

1. ~~Repo shape~~: one project ([D-003](../decisions/README.md)).
2. ~~Package manager~~: pnpm ([D-004](../decisions/README.md)).
3. ~~Seller sign-in~~: passkeys, seller password fallback, admin role ([D-011](../decisions/README.md), design in [seller-auth.md](../architecture/seller-auth.md)).
4. ~~Prototype scope~~: customer and seller together, bit by bit from wireframes ([D-005](../decisions/README.md)).
5. ~~Styling system~~: styled-components, latest React ([D-006](../decisions/README.md)).
6. ~~Open product questions~~: address via WhatsApp only ([D-007](../decisions/README.md)), one pickup window ([D-008](../decisions/README.md)), unconfirmed orders stay open ([D-009](../decisions/README.md)).

7. ~~Passkey packages~~: approved ([D-014](../decisions/README.md)).
8. ~~Chef names~~: seller view only ([D-012](../decisions/README.md)).
9. ~~Chef sign-in~~: near-full helper, last-4-changes audit per order ([D-013](../decisions/README.md)).

## Before phase 1: the dev machine

Settled in [D-015](../decisions/README.md): develop on **ANDRAPC** (192.168.178.177). Owner's one-time setup: install Node LTS, pnpm and mkcert (winget), run `mkcert -install`, reserve the address in the router.

## Phase 1 · Scaffold (stage table)

One builder (sonnet), alone on the tree. Starts after the owner's setup above.

| stage | what | files owned | proof (done when) |
|---|---|---|---|
| 1 | Vite + React + TS strict (`noUncheckedIndexedAccess`), `@cloudflare/vite-plugin` with a `wrangler.jsonc` (no D1/DO bindings yet), HTTPS from `.certs/`, `server.host: true` | root configs, `index.html` | `pnpm dev` serves `https://localhost` and `https://192.168.178.177` |
| 2 | Lint and format: ESLint flat config, typescript-eslint, React Hooks, `import-x/no-cycle` (error), layer import rules ([D-003](../decisions/README.md)), Prettier | `eslint.config.js`, `.prettierrc` | a deliberate cycle fails lint, then is removed |
| 3 | App skeleton: Redux store + root saga, react-i18next with `en.json` / `id.json`, styled-components `ThemeProvider` with light/dark token objects and a contrast unit test, one "hello" screen with the EN/ID switch | `src/app/`, `src/theme/`, `src/i18n/`, empty `src/{features,components,ui,api}/` | Vitest green |
| 4 | Worker: `GET /api/health` returning a typed contract from `shared/`; MSW set up with one handler for the same contract | `worker/`, `shared/`, `mocks/` | unit test for the contract; the hello screen shows the health result |
| 5 | Playwright: projects for mobile WebKit, mobile Chromium, desktop; one smoke spec over HTTPS; captures to `captures/` | `playwright.config.ts`, `e2e/` | smoke spec green on all three projects; capture looked at |

**Gate at the end:** `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` plus the smoke spec; then the owner opens the hello screen on a phone.
**Overlap:** every stage touches root config, so they run in sequence in one builder (no wave).
