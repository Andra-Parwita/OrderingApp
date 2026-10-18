# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here. Older hand-overs are in git history.

**Last session:** 2026-10-17 evening → 18 Oct, the owner's PC (Adelaide), Claude as coordinator. Shipped **1.0.39** (plan 092), **1.0.40** (plan 093) and **1.0.41** (plans 094, 095, 096 + root page).
**Live:** Release **1.0.41** (18 Oct ~11:10; Worker `847e8574-2e33-4695-a63b-30743c3490af`; health OK, devTools false, site reports `1.0.104 · d3a3e1b`; "/" serves `noindex`, title "ShaggyBobo", preview "By invitation · Dengan undangan"); tag `v1.0.41` on `d3a3e1b`; `main` = the hand-over commit after it. Previous: 1.0.40 (Worker `ff9f06f1…`, tag `v1.0.40`), 1.0.39 (Worker `904ef961…`, tag `v1.0.39`), 1.0.38 (Worker `0708ee42…`, tag `v1.0.38`).

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

## 1.0.41: banner everywhere, sheets, notice pills, nudges, root page
Release note (owner "B"): "A fresher look for customers and clearer messages." / "Tampilan pelanggan lebih segar dan pesan lebih jelas."
- **094** one big kitchen banner on every customer page (shell, never remounted; small logo bar gone; closed-menu picture below the banner); seller tablet/phone banners stay mounted; bottom sheets lock the page behind (iOS-safe) and **swipe down to close**; stale `AppRoutes.test` from 092 fixed.
- **095** notice pills (option E2, `uxDesign/seller/mockups/095-notice-bars.html`): floating 40 px pills with the ShaggyBobo icon; new version = green, tap anywhere to refresh, ✕ only hides; announcement/maintenance = amber (`src/components/notice/NoticePill.tsx`, tokens `notice.*`). Admin's short-message *preview* still shows the old bubble (follow-up).
- **096** nudges (`uxDesign/customer/mockups/096-install-nudge.html`): first visit no nudge (menu chip removed); name step "☐ Remember me on all my phones (?)" with an info sheet (tick → turn-on sheet after placing, one tap "Continue"); after the first order "Add to your home screen · How" (stone N1 pill, browser only, ✕ 14 days); Remember me pill after first/delivery order (30 days, max 3, one nudge at a time); empty My orders "Turned on Remember me before? Restore your orders".
- **Root page "/"** (option B of `uxDesign/customer/mockups/097-main-page.html`): standalone page, About hero animation, logo, "Welcome to ShaggyBobo", "Looking for something here? Open the link from the person or group who invited you."; no tab bar, no jump in a browser; inside an installed app it jumps to the last kitchen; `noindex`; neutral link preview "ShaggyBobo · By invitation"; kitchen-not-found clears the saved kitchen (no loop).
**Gate (scoped, 18 Oct):** typecheck, lint, format ✅; **all** unit tests 1905/1905; e2e customer 11 specs ✅ (p087 fixed: spec opened Settings before any kitchen was remembered), seller 5 specs 7/7, short-message + maintenance 2/2. Captures checked: closed menu, dishes, My orders, order page, root page.
**Deploy impact 1.0.41:** client + one head-tag/meta change; no migration, no secret. Installed home-screen apps still start at their kitchen (manifest start_url unchanged). Live check on the iPhone: banner on every page incl. dishes/order, swipe a sheet down, privacy sheet doesn't scroll the page, the green "new version" pill appears after deploy (tap it), send one short message (amber pill), a first test order shows the home-screen pill, the name-step tick, "/" in Safari shows the welcome page.

## Next session (fresh)
1. Read this file, then CLAUDE.md and `docs/guide/agent-working-conventions.md`.
2. Ask the owner whether setup is needed (same PC: usually not; other PC: `git pull`; `pnpm install`; `pnpm db:migrate:local`, never reseed).
3. Ask the owner about the iPhone checks listed under 1.0.41 (and 1.0.39/1.0.40's).
4. **Next release 1.0.42** (owner, 18 Oct): small follow-ups (admin preview pill, unused chip/nudge helpers in `src/api/customer/state.ts`, `CheckoutViews.tsx` 905 lines, real-iPhone check of swipe/scroll-lock) + plan **088** + plan **090**, as ordered in **plan 098** stages 0–3 (owner answers Q1–Q5 first, one at a time; phone page https://claude.ai/artifact/5yCfxuCZJokAxZ2wnZ9iVi).
4. Owner checks still open: 1.0.38 pickup map + QR scan (CSP), send one short message, About animation (seller app: More → About), the seller ✓ on a Remember-me order; 1.0.36/1.0.37 phone checks; a real label print from the Samsung tablet.

## Later (owner rulings recorded)
- **Overnight work:** plan **090** clean-up and plan **088** split large files; plan **091** faster tooling (measure first).
- **v1.1.0 (analysis only, own feature branch later):** plan **082** small store ("Sandra's Store"), plan **098** kinds (kitchen/shop/events/community, menu = event, order = ticket), shared seller frame + per-kind UI, plan **099** bigger grocery store / separate deployments. Owner: "we don't have to implement yet … for now it is analysis, maybe for v1.1.0"; "we will then do a feature branch later". Store must keep the no-flash rule (lesson 31).
- Code health report: `docs/reports/2026-10-17-code-health.html`.
- Older open items: Help screenshots from the live app; customer app Lottie round; 077 leftover (Settings "default cut-off time" in the kitchen's clock); Dellavee feedback; the owner's wife's iPad.

## Local tips
- Playwright needs `NODE_EXTRA_CA_CERTS="C:/Users/Indra/AppData/Local/mkcert/rootCA.pem"`. Lint needs `NODE_OPTIONS=--max-old-space-size=8192`.
- After big edits, the running Vite dev server can serve a stale module ("does not provide an export named …"): restart it (only your own PID).
- iPhone: a home-screen app has its own storage, separate from Safari (it starts with no orders/name).
- Passkeys don't work on the LAN-IP dev URL; use `https://localhost:5173`.

## Ready prompt for the next session
> Read docs/HANDOVER.md, CLAUDE.md and docs/guide/agent-working-conventions.md. Live is 1.0.41 (tag v1.0.41): banner everywhere, sheets, notice pills, nudges, root page. Ask the owner before any git write. Ask me whether setup is needed, then the 1.0.41 phone checks, then plan 098's questions Q1–Q5 for 1.0.42, one at a time.
