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

## Phase 3 · Batch 1 (core loop) stage table

Draft 2026-10-07. Q18 answered: mock API in the dev Worker ([D-021](../decisions/README.md)); Q19: react-router ([D-022](../decisions/README.md)). Batch 1 = C1 menu, C2 basket/checkout, C3 order placed, S1 seller orders, S2 order detail ([wireframes](../design/wireframes/batch-1.html)). Later batches repeat stages 3.0, 3.3–3.5 on the kit and domain built here.

| stage | what | files owned | proof (done when) |
|---|---|---|---|
| 3.0 | **Styled mock-up**: two visual directions (A = the current theme tokens, B = an alternative), each as C1 menu + S1 seller orders in light and dark, with a token/contrast table | `docs/design/mockups/batch-1-directions.html` | owner picks a direction |
| 3.1 | **UI kit** from the picked mock-up: Button, TextField, TextArea, Stepper, Segmented, Pill, ListRow, TabBar, Dialog (second-tap confirm), Toast; the lint rule banning literal values in styled blocks (D-006); a harness route showing every control | `src/ui/`, `src/theme/`, `eslint.config.js` (the one rule) | unit tests; harness capture looked at; contrast test green |
| 3.2 | **Domain + mock data**: shared types (menu, order, order line snapshot D-020, statuses as a union, note D-018, chef D-012), order code generate/parse (forgiving), money in cents; fixtures from the brief; the mock API (question 18) with an "add sample orders" button | `shared/`, `worker/mock/`, `mocks/` (MSW for tests), `src/api/` | unit tests for codes, money, status transitions, parsers |
| 3.3 | **Customer screens** C1–C3 with sagas, EN/ID strings | `src/features/customer-menu/`, `src/i18n/` (customer keys) | component tests; e2e spec on iPhone + Android; captures looked at |
| 3.4 | **Seller screens** S1–S2 with sagas, EN/ID strings | `src/features/seller-orders/`, `src/i18n/` (seller keys) | component tests; e2e spec on desktop + Android; captures looked at |
| 3.5 | **Routing and shell**: react-router (D-022), routes, seller tab bar (D-design nav), move `LanguageSwitch` to `components/`, remove the hello screen; one end-to-end spec: order on a phone → appears in the seller list | `src/app/`, `src/components/`, `e2e/` | the cross-screen spec green; live smoke 0 console errors; owner tries it on a phone |

**Overlap:** 3.1 and 3.2 touch disjoint files. 3.3 and 3.4 are disjoint except `src/i18n/*.json` (split: each owns its own key namespace file, `customer.json` / `seller.json`, merged by 3.5). 3.5 touches the shell and must run last.

**Timelines:**
- Sequential (one builder at a time): 3.0 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5. Simplest, ~6 rounds.
- Parallel (recommended after 3.0): 3.0 → [3.1 ∥ 3.2] → [3.3 ∥ 3.4] → 3.5. Two waves of 2 sonnet builders, gate once after each wave; ~4 rounds.

## Phase 3 · Batch 2 (after ordering) stage table

Approved 2026-10-08 (question 26: "A", no separate mock-up round). Scope = wireframe batch 2 ([batch-2.html](../design/wireframes/batch-2.html)) + the batch 2 features adopted in [D-027](../decisions/README.md). Visual source: the owner's reference prototype ([extraction](../design/reference/delave-prototype-extract.md)) in the D-027 palette; layout source: the wireframes.

| stage | what | files owned | proof (done when) |
|---|---|---|---|
| 4.1 | **Domain + mock API**: order `locked`, `waReceived`, `returning` (sent by the customer's phone from its own My orders history), `source`; customer inbox entries (status changes, nudge, later bulk updates); "Changed" diff in the audit entry; seller-entered order with Confirm-now / Paid flags; kitchen settings (seller WhatsApp number, post greeting/closing EN/ID); ordering open/closed switch + auto-close at cut-off; contracts, client functions, MSW | `shared/`, `worker/mock/`, `mocks/`, `src/api/` | unit tests for every rule (lock blocks customer edits, diff text, auto-close, nudge → inbox) |
| 4.2 | **Customer**: My orders (this week / earlier, unseen-update dot), order page (status timeline, inbox, QR placeholder, change → basket in edit mode, cancel two-tap, locked banner), "How ordering works", returning-customer info, "Send to seller" opens the seller's chat via the stored number | `src/features/customer-menu/`, `src/features/customer-orders/` (new) | component tests; e2e spec (iPhone + Android); captures looked at |
| 4.3a | **Seller orders**: order detail additions (Lock / Unlock, Changed badge + diff, New / Returning / WhatsApp received banners, Nudge), "+ New order" sheet (Confirm now, Mark paid) → order saved → "Send order link on WhatsApp" | `src/features/seller-orders/` | component tests; e2e spec (desktop + Android) |
| 4.3b | **Seller cook + share + settings**: cook list grouped by item / customer / pickup-delivery / chef (D-012) with "who ordered", stats (orders, income, paid, unpaid); share-to-WhatsApp post (ID / EN / Both, greeting, closing, order link); a minimal settings page (WhatsApp number, greeting, closing, open/closed switch) | `src/features/seller-cook/`, `src/features/seller-share/`, `src/features/seller-settings/` (new) | component tests; e2e spec (desktop + Android) |
| 4.4 | **Shell**: routes for all of the above, seller desktop layout (left rail + list/detail split at ≥ 820 px; bottom tabs below), light / dark / auto switch (remembered on the device), one cross-screen e2e: customer orders → seller nudges → customer sees it in the inbox → seller locks → customer can't change | `src/app/`, `src/components/`, `src/theme/` (preference only), `e2e/` | full gate; live smoke 0 console errors; owner tries it on a phone |

**Overlap:** 4.1 must land first (the contracts). 4.2, 4.3a, 4.3b are disjoint feature folders, each with its own i18n bundle and harness file → one parallel wave of 3. 4.4 touches the shell and runs last.
**Timeline:** 4.1 → [4.2 ∥ 4.3a ∥ 4.3b] → 4.4 (3 rounds, gate after each).
**Mock-ups:** no separate mock-up round — the owner's prototype is the approved visual source for every batch 2 feature, and the wireframes cover the rest; the owner reviews the built screens after 4.4.

## Phase 3 · Multi-seller foundation (before batch 3)

Rulings: [D-036](../decisions/README.md) (one app, many sellers), [D-037](../decisions/README.md) (customer link `/<slug>`).

| stage | what | files owned | proof (done when) |
|---|---|---|---|
| 5.1 | **Domain + mock**: `Seller { id, slug, name, … }`; seller id on kitchen/settings/images/menu/chefs/orders; order codes unique per seller, tokens global; mock store keyed by seller with two sample sellers (Onde Onde with the banner, Delave Demo); public `GET /api/s/:slug/menu`, `POST /api/s/:slug/orders`; seller endpoints scoped by a dev `X-Seller` header (phase 4 → session); slug rules + reserved words | `shared/`, `worker/`, `mocks/`, `src/api/` | unit tests incl. **isolation** (seller A can never read or change seller B's orders, settings, menu) |
| 5.2 | **App**: routes `/:slug`, `/:slug/basket`; `/o/:token` resolves the seller from the order; My orders across sellers (seller name on each card); seller screens use the current seller (dev seller picker in the rail, dev only); root `/` simple Delave page; e2e for two sellers side by side | `src/app/`, `src/features/*` (wiring), `e2e/` | full gate; e2e: orders placed at `/onde-onde` never appear for the other seller |

**Overlap:** 5.2 needs 5.1's contracts → sequential. Admin screens for creating sellers come with batch 4 (sign-in and admin).

## Up next (queue, 2026-10-08 22:52)

| # | stage | rulings | state |
|---|---|---|---|
| 1 | 4.9–4.11 banners, native customer app, sub-page headers | D-038–D-042 | ✅ done |
| 2 | (merged into row 1) | | |
| 3 | 5.1 Multi-seller domain + mock (seller id everywhere, isolation tests) | D-036, D-037 | ✅ done |
| 4 | 5.2 Multi-seller app (`/<slug>`, My orders across sellers, dev seller picker) | D-036, D-037 | ✅ done |
| 5 | Batch 3: menu editor, saved sets, week settings, banner/image upload (sizes per D-038), chefs, labels, past weeks, backup, paste-a-post | D-019, D-020, D-027, D-038 | ✅ done 9 Oct (D-043, D-044); polish list on the board |
| 6 | Batch 4: sign-in screens, admin page (create sellers), scan to collect, hand-over, delivery run, bulk updates | D-011, D-013, D-027, D-036 | queued |
| 7 | Phase 4: real backend on this PC (D1, Worker API, Durable Object live updates, passkeys) | D-011, D-014, D-021 | queued |
| 8 | Phase 5: Cloudflare deploy (owner), push, image storage (R2), real QR codes | — | queued |

## Phase 3 · Batch 3 (seller setup) stage table

Approved 2026-10-09 ([D-043](../decisions/README.md)). Scope = wireframe batch 3 ([batch-3.html](../design/wireframes/batch-3.html)) + D-019 (preview as customer), D-020 (order snapshot on edit), D-027 (paste-a-post, past weeks, backup/CSV, retention), D-038/D-040 (five images per seller), multi-seller (D-036). Sign-in, invites and the admin page stay in batch 4.

| stage | what | files owned | proof (done when) |
|---|---|---|---|
| 6.1 | **Domain + mock**: week lifecycle (draft → published, ordering switch, cut-off, one pickup point, delivery note); menu items CRUD (≤ 10, EN/ID, size, price in cents, limit, chef) honouring D-020 (items with orders can't be deleted, only sold out); chefs CRUD (name only); saved sets (≤ 5, items + images); images per seller (5 slots, sizes D-038; dev mock keeps uploads in memory as data URLs, client resizes before upload); past weeks with weekly totals, order details kept 4 weeks (D-027 row 6); backup export/import JSON and orders CSV; pure paste-a-WhatsApp-post parser (shared, EN/ID formats) | `shared/`, `worker/mock/`, `mocks/`, `src/api/` | unit + isolation tests for every new endpoint |
| 6.2a | **Menu editor**: this week's items (add/edit/sold out/remove rules), week images, start from a saved set / copy last week / save as set, **Preview as customer** (D-019), **Paste a WhatsApp post** → items to check | `src/features/seller-menu/` (new) | component tests; e2e desktop + Android |
| 6.2b | **Seller setup**: week settings (cut-off, pickup, delivery, ordering switch), **images editor** (5 slots with size guides, live preview of banner + rail, background colour), chefs list | `src/features/seller-setup/` (new) | component tests; e2e desktop + Android |
| 6.2c | **Labels + history**: print labels (A4 2 × 7, 62 mm roll; code, QR placeholder, first name, items EN/ID, note ≤ 70, pickup/delivery — D-027), past weeks with totals, export/import backup, orders CSV | `src/features/seller-labels/`, `src/features/seller-history/` (new) | component tests; print layout capture; e2e desktop |
| 6.3 | **Shell**: routes, rail "Menu" enabled, More page sections (Settings, Images, Chefs, Labels, Past weeks, Backup), share post uses saved images | `src/app/`, `e2e/` | full gate; owner tries it |

**Overlap:** 6.1 first (contracts). 6.2a/b/c are disjoint new feature folders with their own i18n and harnesses → one wave of 3. 6.3 touches the shell → last.
**Timeline:** 6.1 → [6.2a ∥ 6.2b ∥ 6.2c] → 6.3 — three rounds, gate after each.
**Mock-ups:** the approved batch 3 wireframes + the owner's reference prototype + the desktop A1 style (D-031); no separate mock-up round unless the owner asks (question 41).


## Phase 3 · Batch 4 (sign-in, admin, Saturday) stage table

Approved 2026-10-09 ([D-045](../decisions/README.md)); **done 15:36** — remaining polish on the board. Scope = wireframe batch 4 ([batch-4.html](../design/wireframes/batch-4.html)) + D-011/D-013/D-014 (passkeys, password fallback, chefs), D-027 row 1 (device names, 3 devices per key, 6-digit add-device code, 5 tries → 15-min lockout), D-036/D-037 (admin creates sellers and slugs), D-027 (bulk updates). **Prototype level:** sign-in runs against the dev mock (no real WebAuthn — the passkey button is simulated); real passkeys, sessions in D1 and rate limits arrive in phase 4. Real QR codes and camera scanning need new packages (owner's OK) — left for phase 5; hand-over here works by typed code.

| stage | what | files owned | proof |
|---|---|---|---|
| 7.1 | **Domain + mock**: roles admin / seller / chef; mock sessions (cookie-like token per device, role, seller id); admin bootstrap with a dev setup key; sellers CRUD with slug rules (D-037); invite keys (one-time, 24 h, up to 3 devices, hash only); add-device codes (6 digits, 10 min); devices list + sign out; lockout (5 tries → 15 min); chef invites by the seller; chef permissions (no menu, chefs list, invites); bulk updates to customers' inboxes (templates + custom, recipient groups); "arriving soon" per order; hand-over lookup by code | `shared/`, `worker/mock/`, `mocks/`, `src/api/` | unit + isolation + permission tests |
| 7.2a | **Sign-in screens**: setup key, passkey help (iPhone / Android / Windows-Mac), simulated "Create passkey", password fallback, sign in, devices, add a device (code), lockout message (EN/ID) | `src/features/seller-auth/` (new) | component tests; e2e desktop + Android |
| 7.2b | **Admin page** (desktop-first, EN): admin setup, sellers list + create (name, slug), invite / recovery keys, each seller's devices with sign out, own devices | `src/features/admin/` (new) | component tests; e2e desktop |
| 7.2c | **Saturday tools**: hand-over (type code → order card → Mark collected), delivery run (Out for delivery / Arriving soon / Delivered), **send an update** to many customers (templates "Ready in N min", "Arrived", "Arriving in N min", custom; groups) | `src/features/seller-saturday/` (new) | component tests; e2e desktop + Android |
| 7.3 | **Shell**: routes (`/seller/setup`, `/seller/sign-in`, `/admin…`), route guards by role, the seller comes from the session (dev picker kept as a dev-only override), chef restrictions in rail/tabs/More, Hand-over tab enabled | `src/app/`, `src/main.tsx`, e2e | changed specs green; owner tries it |

**Overlap:** 7.1 first. 7.2a/b/c are new disjoint folders → one wave of 3. 7.3 last.
**Timeline:** 7.1 → [7.2a ∥ 7.2b ∥ 7.2c] → 7.3 (3 rounds).
**Mock-ups:** batch 4 wireframes are approved; no separate mock-up round unless asked.

## Phase 4 · Real backend on this PC (stage table)

Draft 2026-10-09, waiting on question 45. Goal: replace the in-memory dev mock with the real Cloudflare stack **running locally** through `@cloudflare/vite-plugin` (Miniflare): D1 for data, R2 for images, a Durable Object for live updates, real passkeys (D-014) and sessions — same typed contracts, so the screens barely change. Nothing touches Cloudflare's servers until phase 5 (owner's deploy).

| stage | what | files owned | proof |
|---|---|---|---|
| 8.1 | **D1 schema + repository layer**: SQL migrations (`migrations/`) for sellers, kitchens/settings, image refs, weeks, items, chefs, saved sets, orders + lines (snapshots, D-020), audit (last 4), inbox, past-week totals + expired-order summaries (D-044), auth (accounts, devices, sessions, hashed keys/codes, lockouts); one `Repository` interface with a **D1 implementation** and the existing in-memory one kept **for unit tests only**; a **seed script** for local dev data that refuses to run without an explicit `--local` target (conventions §6) | `migrations/`, `worker/db/`, `worker/repo/`, `scripts/seed-local.mjs` | contract tests run against both implementations; migrations apply cleanly to a scratch local D1 |
| 8.2 | **Real sign-in**: WebAuthn with `@simplewebauthn/server` + `/browser` (D-014) for admin, seller and chef; password fallback (PBKDF2) kept; sessions in D1 delivered as an **HttpOnly `__Host-` cookie** (per [seller-auth.md](../architecture/seller-auth.md)) instead of the prototype's bearer token; `Origin` check on writes; lockout + rate limits in D1 | `worker/auth/`, `src/api/` (auth client), `src/features/seller-auth/` + `admin/` (real passkey calls) | unit tests incl. replayed/forged assertions rejected; passkey e2e with Playwright's virtual authenticator |
| 8.3 | **Live updates + images**: one Durable Object per seller (WebSocket Hibernation API) pushing order changes to signed-in seller devices; seller orders + cook list switch from 15 s polling to the live connection (polling kept as fallback); images stored in **R2** (local), served through the Worker with cache headers; upload path keeps the server-side checks | `worker/live/`, `worker/images/`, seller-orders + seller-cook sagas | unit tests for the DO; e2e: an order placed on one page appears on the seller page within 2 s |
| 8.4 | **Switch over + retention**: Worker routes use the D1 repository; the dev mock and `/api/dev/*` are removed (D-021), except a dev-only reset/seed route against the local DB; **cron trigger** for weekly retention (4 weeks → totals); e2e runs on a **scratch local D1** created per run (asserted in the same command); docs: architecture overview, data model, API | `worker/`, `src/`, `e2e/`, `playwright.config.ts`, `docs/architecture/` | full gate; changed specs green on scratch D1; owner tries it on this PC |

**Overlap:** 8.1 first (schema + repository). 8.2 (auth) and 8.3 (live + images) touch different folders → a wave of 2. 8.4 last.
**Timeline:** 8.1 → [8.2 ∥ 8.3] → 8.4 (3 rounds).
**Packages:** `@simplewebauthn/server` and `@simplewebauthn/browser` are already approved (D-014); nothing else new.
**Data safety:** every DB-backed test uses a scratch D1, asserted in the same command; nothing ever points at a remote database in phase 4.
