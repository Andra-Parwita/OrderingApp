# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here. Older hand-overs are in git history.

**Last session:** 2026-10-17 evening (~22:15–23:20), the owner's PC (Adelaide), Claude as coordinator. Built and shipped **1.0.39** (plan **092 Remember me polish**) and **1.0.40** (plan **093** banner no flash), both hotfixes on top of 1.0.38.
**Live:** Release **1.0.40** (17 Oct ~23:33; Worker `ff9f06f1-5788-4dd3-b6fb-4dc9968065cc`; health OK, devTools false, site reports `1.0.102 · ec41e17` (build number = commit count)); tag `v1.0.40` on `ec41e17`; `main` = the hand-over commit after it. Previous: 1.0.39 (Worker `904ef961…`, tag `v1.0.39` on `b63e899`), 1.0.38 (Worker `0708ee42…`, tag `v1.0.38`).

## House rules (binding)
- **No git writes (commit, push, merge, tag) unless the owner says so for that step; ask first every time.** Stage only your own files, by path; never `git commit -a` while a builder edits the tree.
- **Owner decides; one question at a time** (A/B/C with a recommendation), status marker on every message (🔴 / 🟡 / 🟢), plain words.
- **Mock-up before any UI build;** open mock-ups in the owner's browser (`Start-Process <url>`; viewer `python -m http.server 8765 --bind 127.0.0.1`, use the **127.0.0.1** address).
- **AUD and Adelaide only** in mock-ups and samples.
- **Real clock times only** in `docs/plans/live-status.md` and to the owner (read the clock with `Get-Date`; this session first gave guessed times and had to correct them).
- **Gate scope for small changes** (owner, 17 Oct: "run also only selected test if needed"): typecheck + lint/format on changed files + the unit tests of the touched areas + the e2e specs of every touched screen; the full suite only when the owner asks.
- Files under ~750 lines (soft); don't grow routes.ts, seller.ts, menus.ts, auth.ts, AppRoutes.tsx.
- Agents never deploy, never run `--remote` / `wrangler secret`, never reseed; back up before migrations.

## 1.0.39 (plan 092, D-108): what's in it
Source: the owner's first real-phone use of Remember me (iPhone home-screen app, passkey saved in Keeper → no address lock; after switching to Apple Passwords the lock worked).
1. First name asked before the passkey prompt, with Skip.
2. "We keep your address so it's filled in for you next time."
3. No app lock (Face ID only for the saved address).
4. Remember me card calmer (one Turn on, quiet links; on-state as a tidy list).
5. Privacy note with headings + bullets.
6. "lock/locked" instead of "seal/sealed" (ID "dikunci/terkunci"); intro "We remember your orders, name and address on this phone and on any other phone you use."
7. Hint: choose Passwords (iPhone) or Google Password Manager (Android); other password apps can't lock the address.
8. Passkey names by role: "<name> · customer (Remember me)", "<name> · seller", "<name> · admin"; no name: "Remember me · ShaggyBobo's Order" etc. Only new passkeys.
9. Every bottom sheet slides up (none with Reduce Motion).
10. Customer Settings: value rows ("Appearance  Dark ›") open a choice sheet (option D of `uxDesign/customer/mockups/092-settings-align.html`).
Release notes: "Small fixes and polish." / "Perbaikan kecil dan penyempurnaan." (owner "B").
**Gate (scoped, 17 Oct 23:06):** typecheck, lint, format ✅; unit 105/105; e2e 14/14 over p087-remember-me, customer-batch1/2, native-customer, pickup-map, p083-change-fulfilment, seller-saturday, seller-list-scroll (mobile-chromium + iphone-chromium). Captures at 390 px checked.
**Deploy impact 1.0.39:** no migration, no new secret; client + worker labels only. Existing passkeys keep their old names. Low risk. Deploy order: `pnpm build` → `pnpm exec wrangler deploy` → live check (Settings rows + sheets, Remember me turn-on with first name on a real iPhone, privacy note) → merge `main` + tag `v1.0.39` (ask first).

## 1.0.40 (plan 093): banner doesn't flash
Owner, 17 Oct: "changing page make the image banner on top flashing and kept reloading" (older bug, since `key={pathname}` on the page slide, 10 Oct). Fix: the banner is drawn once in `CustomerShell` (`src/app/ShellBanner.tsx`) above the sliding page; pages' own `KitchenBanner` renders nothing inside the shell (context `ShellOwnsBanner`), still renders in seller preview; the last loaded banner stays while the same kitchen reloads; the skeleton is now banner-sized (3:1). Release note reuses "Small fixes and polish." **Gate (scoped, 23:31):** typecheck, lint, format ✅; unit 370 + 99; e2e customer-batch1/2, native-customer, p087, pickup-map 12/12; capture: banner stays across My orders ↔ Settings. **Deploy impact:** client only, no migration, no secret. Live check: switch Menu ↔ My orders ↔ Settings on the iPhone; the banner must not flash.

## Next session (fresh)
1. Read this file, then CLAUDE.md and `docs/guide/agent-working-conventions.md`.
2. Ask the owner whether setup is needed (same PC: usually not; other PC: `git pull`; `pnpm install`; `pnpm db:migrate:local`, never reseed).
3. Ask the owner about the 1.0.39/1.0.40 live checks on the iPhone (Settings rows + sheets, Remember me turn-on with first name, privacy note, banner stays still across Menu ↔ My orders ↔ Settings).
4. Owner checks still open: 1.0.38 pickup map + QR scan (CSP), send one short message, About animation (seller app: More → About), the seller ✓ on a Remember-me order; 1.0.36/1.0.37 phone checks; a real label print from the Samsung tablet.

## Later (owner rulings recorded)
- **Overnight work:** plan **090** clean-up and plan **088** split large files; plan **091** faster tooling (measure first).
- **Much later:** plan **082** store mode.
- Code health report: `docs/reports/2026-10-17-code-health.html`.
- Older open items: Help screenshots from the live app; customer app Lottie round; 077 leftover (Settings "default cut-off time" in the kitchen's clock); Dellavee feedback; the owner's wife's iPad.

## Local tips
- Playwright needs `NODE_EXTRA_CA_CERTS="C:/Users/Indra/AppData/Local/mkcert/rootCA.pem"`. Lint needs `NODE_OPTIONS=--max-old-space-size=8192`.
- After big edits, the running Vite dev server can serve a stale module ("does not provide an export named …"): restart it (only your own PID).
- iPhone: a home-screen app has its own storage, separate from Safari (it starts with no orders/name).
- Passkeys don't work on the LAN-IP dev URL; use `https://localhost:5173`.

## Ready prompt for the next session
> Read docs/HANDOVER.md, CLAUDE.md and docs/guide/agent-working-conventions.md. Live is 1.0.40 (tag v1.0.40): Remember me polish (092, in 1.0.39) and banner no flash (093). Ask the owner before any git write. Ask me whether setup is needed, then the open phone checks, then which plan is next, one question at a time.
