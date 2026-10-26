# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here. Older hand-overs (1.0.39 → 1.0.44.3 detail) are in git history.

**Last session:** 25 → 26 Oct, the owner's PC (Adelaide), Claude as coordinator. 1.0.44 and hotfixes 1.0.44.1–.3 shipped (25 Oct). **1.0.45 = plan 124 (seller phone menu card) deployed 26 Oct, owner live check ✅.**
**Live:** **1.0.45** (26 Oct; Worker `e711941c-15be-4e78-ba20-8c1430562942`; commit `addc394`; health ok). Before: 1.0.44.3 (`15ad732a-132e-4503-b70d-5214d820b3d1`), 1.0.44.2 (`70e17010…`), 1.0.44.1 (`8e7bca61…`), 1.0.44 (`5c5ee9c4…`). Backups: `backups/shaggybobo-2026-10-26.sql` (before 1.0.45), `…-25.sql`, `…-25-b.sql`.
**Branch:** `main` (clean after the hand-over commit); tag `v1.0.45`.

## House rules (binding)
- **No git writes (commit, push, merge, tag, force push) unless the owner says so for that step; ask first every time.** Stage by path; never `git commit -a` while a builder edits the tree. No Claude attribution in commit text.
- **Rebase, not merge**; **build, deploy and tag from `main`**.
- **Owner decides; one question at a time** (A/B/C with a recommendation), wait for "go next question"; status marker on every message (🔴 / 🟡 / 🟢), plain words. **Never a bare plan number:** add a few words saying what it is (owner 26 Oct).
- **Commands for the owner one per line** in their own code block, never in table cells.
- **Mock-up before any UI build,** as local HTML in `uxDesign/*/mockups/`, opened with `Start-Process http://127.0.0.1:8765/…` (viewer: `python -m http.server 8765 --bind 127.0.0.1`). AUD and Adelaide only.
- **Real clock times only** in `docs/plans/live-status.md` (read the clock: `TZ=Australia/Adelaide date`).
- Agents never deploy, never run `--remote` / `wrangler secret`, never reseed the owner's local DB; emulator and manual checks run on a **copy** of `.wrangler/state` (`DELAVE_PERSIST_DIR=scratch/<x>/state`, own port). No Fable unless the owner asks.
- **Plan list and roadmap current (D-115)** at plan start/mock-up, done, and before every deploy, then `pnpm run docs`.
- **Android phone emulator check** for seller-phone or customer-facing changes (Pixel_9); the agent shuts it down at the end (owner: no need to leave it running).
- Files under ~750 lines (soft).

## 1.0.45 = plan 124, seller phone menu card (live 26 Oct)
Why: DellaVee's seller makes the menu on a shared family tablet with no WhatsApp and sent the link to her phone by Bluetooth. Owner rulings Q1–Q8 in `docs/plans/124-phone-menu-share.md`; mock-up `uxDesign/seller/mockups/124-phone-menu-card.html`.
- **Owner only, phone layout only** (chefs, helpers and the tablet unchanged). A **Menu card** inside the Orders list: *Ready to publish* → publish sheet → "Menu is live ✓" (Share + notice); *Not ready* (amber, "Finish on the tablet: …", no button); *Live* (**Share menu** + **🔔 Notice**, any number of times); after the cut-off status only (Q7 B, `SHARE_AFTER_CUTOFF = false`).
- **Share menu**: full-screen layer, Share in the top bar (keyboard-safe, follows `visualViewport`), language ID/EN/Both remembered on the phone, the ready-made post in an editable text box kept for the next person ("Back? Your text is still here…"), Reset text, Copy text; Close forgets. Share opens the phone's own share list (WhatsApp, SMS, email…); WhatsApp link only where a browser has none.
- **Read-only menu** from the card; **Android Back** closes the top layer/sheet first (`useLayerStack`, history entries; Q8 A).
- Code: `src/features/seller-menu/phone/`, share text moved to `src/components/shareText/` (seller-share re-exports), `NotifyBell` logic as `useMenuNotice()`. Shared change: `OVERLAY_Z = 1100` in `src/ui/patterns/modal.ts`, so **every bottom sheet now sits above the top bars** (update, offline, what's new).
- Version `RELEASE_VERSION = '1.0.45'`; release note EN/ID (owner "A") in `releaseNotes.ts`.
- **Checks:** two Android emulator rounds (`scratch/emu-124/`, `scratch/emu-124b/`): round 2 all 9 ✅ incl. Back in Chrome and the installed app. Gate: lint 0, format ✅, unit 3,049 ✅ (30 EADDRINUSE flakes pass with `--no-file-parallelism`), e2e 10 ✅ (order-flow, batch2-flow, banners, customer-live, multi-seller, helper-flow), docs built.
- **Deploy impact: low.** Client only: no migration, no Worker or API change, no secret. Old seller apps keep working; the new card shows after the app updates.

## Deploy 1.0.45 (done 26 Oct: backup, build, deploy, health, live check ✅)
0. Docs current (done: plan list, roadmap, `pnpm run docs`).
1. Commit on `main` (owner OK), push.
2. Backup (optional for a client-only release): `pnpm exec wrangler d1 export shaggybobo-order --remote --output backups/shaggybobo-2026-10-26.sql`
3. `pnpm build`
4. No migration.
5. `pnpm run deploy -- --tag v1.0.45 --message "1.0.45: seller phone menu card (publish, notice, share menu)"`
6. Health: `curl https://order.shaggybobo.app/api/health`
7. Live checks: on an Android phone signed in as the DellaVee owner → Orders shows the Menu card → Share menu → change the first line → Share → WhatsApp → back, text still there → Back closes the layer; read-only menu; 🔔 Notice opens (send only if wanted); a chef/helper phone shows no card; tablet unchanged.
8. Tag `v1.0.45` on `main` + push (ask first).

## Open findings
- **"Orders" title clipped to "Orde"** in English on the phone when the camera, New order and bell buttons show (seen on the emulator; older than plan 124). Also "● Li…" pill clipped right after publishing. Fix later.
- 1.0.43.3: one-off blank banner on an iPhone cold start, not reproduced. Watch.
- Time-bomb leftovers (low): `e2e/p039-captures.spec.ts` resets data without pushing the cut-off; passkey counter ~2033; seed-local data goes stale.
- The empty, locked folder `D:\Projects\home\OrderingApp-hotfix` can be deleted after a reboot.
- Unused: `public/guides/template-phone-banner.png` (ask before deleting).
- Scratch copies `scratch/emu-124/state`, `scratch/emu-124b/state` can be deleted.

## Later (owner rulings recorded)
- **1.0.46 candidates:** iOS-style large titles on pages without a banner (mock-up first); plan 116 "Send a problem report" (device log + "What happened?" to the admin); the 6 chef permissions, one at a time.
- Maybe: the tablet Share screen remembers the language like the phone does.
- **v1.1.0 (analysis only):** plans 082/098/099 (store, kinds, separate deployments).
- Older open owner checks: 1.0.42 live checks, 1.0.38 pickup map + QR scan, a real label print.

## Local tips
- Playwright with `--no-deps` needs `NODE_EXTRA_CA_CERTS="C:/Users/Indra/AppData/Local/mkcert/rootCA.pem"` (else "unable to verify the first certificate"); specs pick their own project (`order-flow`/`batch2-flow` on `iphone-chromium`, desktop parts on `desktop-chromium`); one Playwright run at a time. Lint needs `NODE_OPTIONS=--max-old-space-size=8192`. `mocks` and `sellerAuth` tests: `--no-file-parallelism` (Windows port exhaustion).
- Android emulator: `D:\Android\sdk\emulator`; AVDs Pixel_9 (`-memory 4096`), Pixel_8a, Tablet_11; `adb reverse` + mkcert CA installed; PIN 1234. Dev API writes from scripts need an `Origin: https://localhost:<port>` header.
- iPhone: a home-screen app reads the head only at "Add to Home Screen" (lesson 44); iOS 26 blurs under the status bar (lesson 45).
- Passkeys don't work on the LAN-IP dev URL; use `https://localhost:5173`. Wrangler auth error 10000 → `wrangler login` (or set a `CLOUDFLARE_API_TOKEN`).

## Next session
1. Watch DellaVee's seller use the phone Menu card on this week's menu (Sat 31 Oct); ask how sharing went.
2. Owner cleanup: the duplicate Remember me account + its unnamed passkey (keep "Indra · customer"); re-add the old Onde Onde app.
3. Optional: a Cloudflare API token in `CLOUDFLARE_API_TOKEN` (owner runs `setx`; never paste the token in chat).
4. Then pick 1.0.46 from "Later", one question at a time.

## Ready prompt for the next session
> Read docs/HANDOVER.md, CLAUDE.md and docs/guide/agent-working-conventions.md. Live is 1.0.45 (tag v1.0.45, Worker e711941c). Start with "Next session" in the hand-over, one question at a time. Ask the owner before any git write.
