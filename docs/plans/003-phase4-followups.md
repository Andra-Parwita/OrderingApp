# 003 · Phase 4 follow-ups

**Status:** done (2026-10-10, 01:24). Gate: static green; unit 1133/1133 on the 2nd run (the 1st had one load flake in `sellerOrdersSaga` live updates); e2e auth-mobile 4 (+1 skip), auth-desktop 5, session-flow 1, desktop-chromium 22 (+3 skip)
**Goal:** close the small loose ends left at the end of phase 4 so the app is tidy before web push (plan 002). Nothing new for users except the cook screen's "Live" dot.

Context: D-070 (plan 001 on hold; carry on from phase 4). The findings come from the [board](../plan/board.md) → Findings, 9 Oct.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Sign-out everywhere stops refreshes.** The Devices screen's "sign out here" goes through `useSession().end()`, which dispatches `staffSignedOut` first, as Switch person and More → Sign out already do. | the Devices screen in `src/features/seller-auth/`, `src/app/session.tsx` | no seller request is made after sign-out from Devices; typecheck passes |
| 2 | **Test for the cook saga's stop-on-sign-out.** Mirror the orders saga test ("issues no seller fetch and closes the socket once staff sign out"). | `src/features/seller-cook/cookSaga.test.ts` | the test exists and fails without the one-line stop in `cookSaga.ts` (shown once, then restored) |
| 3 | **Cook screen "Live" dot.** Replace the cook screen's "Live" text (it follows the last fetch) with the shared `LiveDot`, which follows the socket: live, reconnecting, offline. | `src/features/seller-cook/`, `src/features/seller-orders/LiveDot.tsx` (reuse, don't copy) | the cook screen shows the same dot as the orders screens; typecheck passes |
| 4 | **Saturday hand-over test under load.** `saturday.test.tsx` "shows the date and counts…" missed its heading once in the full run (it passes alone). Give that wait a longer timeout, or raise the global `asyncUtilTimeout` if more tests need it. | `src/features/seller-saturday/saturday.test.tsx` (or `vitest.setup`) | passes in 3 full `pnpm test` runs in a row |

## End of phase

- [ ] Full gate: `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test` · Playwright `--project=auth-desktop-chromium`, `session-flow` and `desktop-chromium`, one at a time with `--no-deps`
- [ ] A capture of the cook screen with the dot, looked at
- [ ] The builder tries sign-out from Devices on the PC

## Decisions and notes

- **Doc tidy-ups for the owner** (found while reviewing the 10 Oct pull). They are suggestions only, not edited here, because they are the owner's documents:
  - CLAUDE.md says "One seller, 10–50 orders a menu"; the app is multi-seller (D-036).
  - Plan 001's setup says Node 22; ANDRAPC runs Node 24.19 and the project was built on it.
  - `uxDesign/seller/README.md` says `npm i -D playwright`. That's not needed: `capture.mjs` falls back to the installed `@playwright/test`, and an npm install would add a package outside pnpm.
  - The handoff's "No phone numbers or addresses stored" is overridden by D-069 Q1 (kept on the seller's phone). Plan 001 already says D-069 wins.
- **Found at the end-of-phase gate (10 Oct, 00:55), fixed in this plan:**
  - The moved `LiveDot` test lacked the `matchMedia` stub.
  - **A date time bomb:** the sample week's cut-off (Fri 9 Oct 21:00) had passed, so fresh test DBs refused orders. The seed is now built from `now` (lesson 16).
  - "My orders" grouping compared with UTC midnight, so an order placed early on Saturday morning for next Saturday showed as "earlier".
  - `multi-seller.spec` still expected no pictures on Dapur Demo (D-054 gives dev kitchens sample pictures).
