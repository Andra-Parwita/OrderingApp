# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here. Older hand-overs (1.0.39 → 1.0.43.3 detail) are in git history.

**Last session:** 24 → 25 Oct (Sat–Sun night), the owner's PC (Adelaide), Claude as coordinator. Hotfixes 1.0.43.2 and 1.0.43.3 shipped; **1.0.44 fully built, waiting for the final gate result and the owner's deploy** (owner, 25 Oct ~00:50: "we will deploy tomorrow").
**Live:** **hotfix 1.0.44.1** (25 Oct; Worker `8e7bca61-bae9-4c76-bc3b-91beff03c0d3`, tag + message on the version; `main` = `b39811c`; tall phone banner, plan 123; no migration). Before: 1.0.44 (Worker `5c5ee9c4-919a-4dfd-906a-6100ac3de537`, 07:02, live checks ✅ all 6). Backups: `backups/shaggybobo-2026-10-25.sql`, `…-25-b.sql`.
**Branch:** `indra/brand_logo_ux` = `369c660` (1.0.44 WIP, rebased on main, pushed) **plus a large uncommitted working tree** (everything below). The owner has not yet said whether to commit it.

## House rules (binding)
- **No git writes (commit, push, merge, tag, force push) unless the owner says so for that step; ask first every time.** Stage by path; never `git commit -a` while a builder edits the tree. No Claude attribution in commit text.
- **Rebase, not merge** (owner 24 Oct); **build, deploy and tag from `main`** (fast-forward `main` to the release commit first).
- **Owner decides; one question at a time** (A/B/C with a recommendation), status marker on every message (🔴 / 🟡 / 🟢), plain words.
- **Mock-up before any UI build,** as local HTML in `uxDesign/*/mockups/`, opened with `Start-Process http://127.0.0.1:8765/…` (viewer: `python -m http.server 8765 --bind 127.0.0.1`). AUD and Adelaide only. Artifacts only when asked.
- **Real clock times only** in `docs/plans/live-status.md` and to the owner (read the clock first).
- Agents never deploy, never run `--remote` / `wrangler secret`, never reseed the owner's local DB (migrate-only is fine); back up before migrations. No Fable unless the owner asks.
- **Plan list and roadmap current (D-115)** at plan start/mock-up, plan done, and **before every deploy** (step 0), then `pnpm run docs`.
- **Customer multi-kitchen emulator check before every customer-facing deploy:** phone emulator against the local build, two kitchens, three starting points (browser only; a Chrome bookmark; both installed as apps). Check: the right kitchen opens, splash, menu, ordering, My orders, old and new order links.
- Files under ~750 lines (soft).

## 1.0.44: what's in it (all built, uncommitted on `indra/brand_logo_ux`)
- **101** seller app per kitchen (`/seller?k=<slug>` manifest, own name and icon per kitchen). **102** customer pages under the kitchen (`/<slug>/o/<token>`; old `/o/<token>` links get a 302), one install button. `KITCHEN_SCOPE` var stays **"off"** at deploy.
- **118** join another kitchen (Settings), switch by the kitchen name at the top of the left menu (tablet only; no arrow with one kitchen), language in Settings on the tablet.
- **D-120** My orders per kitchen; kitchen-confusion fixes from the emulator (titles per kitchen instead of "ShaggyBobo", Settings shows the current kitchen, last-kitchen redirects).
- **113** fewer DB round trips (items 3–7; backup file unchanged, comparison test).
- **121** nudges in My orders (Remember me / notifications, one card at a time, dismiss rules) + anonymous order statistics (migration **0034**, admin "Statistics" card only).
- **Smaller phone banner** (aim ~100 KB, `PHONE_BANNER_TARGET_KB`).
- **122 iPhone status bar** (customer pages only, iOS home-screen app only): see-through status bar; behind the clock the kitchen's **banner background picture** (owner "A4"), else a blurred copy of the banner, else the colour; an always-on thin fade; no double gap under the banner. The background picture is fetched only inside the iPhone app. Later option (owner "A for now"): taller 1200 × 570 banner.
- **No duplicate Remember me accounts:** the turn-on sheet and Settings (off) offer "Turned on Remember me before? Restore your orders"; iPhone card "Turn on or restore"; Settings (on) shows "Name" and "Turned on: <date>" (`createdAt` on `/api/customer/me`). Auto-detecting an existing passkey is not possible on the web (recorded in plan 121).
- **Time bombs defused** (5): `mocks/demo.test.ts` frozen clock (failed Fri 21:00–24:00), e2e global setup pushes sample cut-offs a week out (`e2e/sampleCutoff.ts`), About "New" test follows `RELEASES[0]`, version pins read `RELEASE_VERSION`, e2e `sampleDay` read from the server.

## Not done yet (before the deploy)
1. ~~Final gate~~ **✅ 25 Oct 00:46–01:30:** typecheck, lint (needs `NODE_OPTIONS=--max-old-space-size=8192`), format ✅; unit 2,939 passed + 22 load failures (EADDRINUSE / timeouts) that all pass alone, 193/193 (`scratch/gate-044*.log`); build ✅, customer entry 914 KB (limit 1,100); full e2e **130 passed, 0 failed, 46 skipped by project** with `--workers=2` (`scratch/e2e-044b.log`; the default-workers run had 2 load flakes). Re-run only if code changes (release note + version bump: run the About/version unit tests).
2. **Release note + version bump** (owner picks the text, one question): `RELEASE_VERSION = '1.0.44'` in `shared/release.ts` and a new first entry in `src/features/seller-about/releaseNotes.ts` (EN/ID). The tests now follow these automatically.
3. ~~Emulator check~~ **✅ 25 Oct 05:34–05:49** (Pixel_9, local build, commit 945a55c): browser, bookmark and two installed apps each open the right kitchen; My orders per kitchen; old `/o/<token>` → 302 and new links; nudge ✕; Settings restore line. Screenshots `scratch/emu-044/`. Seen once, not reproduced: the splash stayed > 40 s on an adb-launched open with 9 Chrome tabs (refresh fixed it) — watch on real phones after the deploy. Nudge ✕ is per phone (plan 121: device-only state), so it also hides the card in the other kitchen.
4. `pnpm run docs`; plan list (101, 102, 113, 118, 121, 122 → ✅ at deploy) and roadmap (D-115).
5. ~~Commit~~ ✅ `945a55c` on `indra/brand_logo_ux` (local, owner "A"); at deploy: version bump + release note commit, then fast-forward `main`.

## Deploy steps 1.0.44 (owner runs them, one at a time; Claude shows the full numbered table)
| # | step |
|---|---|
| 0 | docs current: plan list + roadmap + `pnpm run docs` |
| 1 | commit on `indra/brand_logo_ux` (owner OK), fast-forward `main` to it (rebase first if `main` moved), check out `main` |
| 2 | backup: `pnpm exec wrangler d1 export shaggybobo-order --remote --output backups/shaggybobo-2026-10-2X.sql` (then Claude gives the backup summary) |
| 3 | `pnpm build` (from `main`) |
| 4 | **migration 0034 first:** `pnpm exec wrangler d1 migrations apply shaggybobo-order --remote` |
| 5 | `pnpm run deploy -- --tag v<version> --message "<version>: <short description>"` (tag + message on every Worker version from 1.0.45, owner 25 Oct "A"; 1.0.44 was deployed without) |
| 6 | health: `curl https://order.shaggybobo.app/api/health` + site code number |
| 7 | live checks (below) |
| 8 | tag `v1.0.44` on `main` + push (ask first) |
Deploy on a day with **no open DellaVee menu**. `KITCHEN_SCOPE` stays "off".

**Deploy impact 1.0.44:** medium (size). One add-only migration (4 nullable columns), applied **before** the Worker; old clients send no `stats` (NULL, never fails an order). Old `/o/<token>` links keep working (302). New fields (`createdAt`) are ignored by old clients. iPhone status bar and launch picture change only after the app is re-added.

**Live checks 1.0.44:** customer order end to end on the iPhone (DellaVee); old order link opens; My orders shows only this kitchen inside the app; nudge card shows and ✕ hides it; Settings → Remember me shows Name + "Turned on"; re-add the iPhone app (Safari → pull to refresh → Add to Home Screen) and check the status bar (background picture behind the clock, white time readable, also after scrolling); seller tablet name switcher + join; admin Statistics card; one seller order edit; console has no CSP errors.

**After the deploy (owner):**
- DellaVee and Onde Onde re-save their phone banner once (seller app → Settings → Kitchen → Pictures → Phone banner → Change → the original file), so it is ~100 KB.
- Duplicate Remember me: keep "Indra · customer" (DellaVee), delete the other account (Settings → Remember me → Delete my saved data, in the app where it is active) and its unnamed passkey in Passwords.

## Open findings
- 1.0.43.3: one-off blank banner on an iPhone cold start (`temp/bug/img_1.png`), not reproduced; the preload/reveal/SW cache fix is live. Watch for it.
- Time-bomb audit leftovers (low): `e2e/p039-captures.spec.ts` resets data without pushing the cut-off (capture spec only); p039 captures use the UTC day (cosmetic); passkey counter ~2033; seed-local dev data goes stale.
- The empty, locked folder `D:\Projects\home\OrderingApp-hotfix` can be deleted after a reboot.

## Later (owner rulings recorded)
- **After 1.0.44:** iOS-style large titles on pages without a banner (idea, mock-up first; roadmap); taller 1200 × 570 phone banner (plan 122 note); 116 seller problem report; the 6 chef permissions, one at a time; 120 parked (app-store analysis in `docs/product/app-store-roadmap.md`).
- **v1.1.0 (analysis only):** plans 082/098/099 (store, kinds, separate deployments), own feature branch later.
- Older open owner checks: 1.0.42 live checks, 1.0.38 pickup map + QR scan, a real label print.

## Local tips
- Playwright needs `NODE_EXTRA_CA_CERTS="C:/Users/Indra/AppData/Local/mkcert/rootCA.pem"`; one Playwright run at a time. Lint needs `NODE_OPTIONS=--max-old-space-size=8192`. `mocks` tests: `--no-file-parallelism` (Windows port exhaustion).
- Android emulator: `D:\Android\sdk\emulator`; AVDs Pixel_9 (`-memory 4096`), Pixel_8a, Tablet_11 (seller); `adb reverse` + mkcert CA installed; phone PIN 1234.
- iPhone: a home-screen app has its own storage; iOS reads the head (launch picture, status bar) only at "Add to Home Screen" (lesson 44).
- Passkeys don't work on the LAN-IP dev URL; use `https://localhost:5173`.
- Wrangler auth error 10000 → `wrangler login`.

## Hotfix 1.0.44.1 = plan 123, tall phone banner (built 25 Oct, uncommitted on main)
- Phone banner upload accepts 1200 × 400 or **1200 × 600**; everywhere only the bottom 3 : 1 shows; in the iPhone customer app the top 200 px fills the clock area, sharp, no blur, no fade (owner rulings in plan 123). Same upload in seller Settings and the admin kitchen pictures. Upload help EN/ID + template `public/guides/template-phone-banner-tall.svg`.
- Gate (scoped): typecheck, lint, format ✅; unit 1,056 ✅; e2e 16 ✅; bundle 956 KB. Client only: no migration, no Worker change. No version bump, no release note (hotfix).
- Known: first load on an iPhone may briefly show 1.0.44's band before the tall picture is known.
- Pictures made 25 Oct (`D:\Projects\home\assets\`): DellaVee `DapurDellaVee_banner_1200x600.jpg`, `…_magical.jpg`, `…_enchanted.jpg` (Claude recommends enchanted); Onde Onde `OndeOnde_banner_1200x600.jpg`. Comparison `uxDesign/customer/mockups/123-banner-versions.html` (images in git-ignored `temp/banner-versions/`). Prompts: `docs/architecture/images.md`.
- Deploy: backup → `pnpm build` → no migration → `pnpm run deploy -- --tag v1.0.44.1 --message "1.0.44.1: tall phone banner"` → health → upload the new banners → tag `v1.0.44.1` + push.
- Unused now: `public/guides/template-phone-banner.png` (ask the owner before deleting).

## Hotfix 1.0.44.2 = tall banner blur fix (25 Oct)
- Owner's iPhone (iOS 26) showed the top of the tall DellaVee banner blurred and dim at rest, sharp when pulled down. Not reproducible in WebKit on Windows; likely the fixed thin page fade at first paint plus an iOS 26 blur under fixed top elements (unverified). Fix: the fade stays off until the banner shape is known and, for a tall banner, until it has scrolled away (`useFadeHold`); constant `BLUR_TALL_BANNER` (false) brings back the soft look. Client only, no migration.
- If the top is still blurred after this deploy, it is iOS itself; then the planned setting (Clear / Light 8 px / Soft 12 px / Strong 20 px, mock-up `uxDesign/customer/mockups/123-clock-area-setting.html`, plan 123 stage 5) offers blur strengths only.

## Next session
1. Owner cleanup: the duplicate Remember me account + its unnamed passkey (keep "Indra · customer"); Onde Onde phone banner re-save if not done.
2. Optional: a Cloudflare API token in `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers" + D1 Edit) so wrangler stops asking to log in (owner runs `setx` themselves; never paste the token in chat).
3. Watch real phones for the one-off long splash seen on the emulator, and the first Statistics numbers after the next menu.
4. Then pick from "Later": iOS large titles (mock-up first), 116, the 6 chef permissions.

## Ready prompt for the next session
> Read docs/HANDOVER.md, CLAUDE.md and docs/guide/agent-working-conventions.md. Live is 1.0.44 (tag v1.0.44, Worker 5c5ee9c4). Start with "Next session" in the hand-over, one question at a time. Ask the owner before any git write.
