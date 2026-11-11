# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here. Older hand-overs (1.0.39 → 1.0.44.3 detail) are in git history.

**Last session:** 25 → 26 Oct, the owner's PC (Adelaide), Claude as coordinator. 1.0.44 and hotfixes 1.0.44.1–.3 shipped (25 Oct). **1.0.45 = plan 124 (seller phone menu card) deployed 26 Oct, owner live check ✅. Hotfix 1.0.45.1 = plan 125 (version + Check for update + sign-out fixes) deployed 27 Oct 00:35 by Claude (owner's one-time OK for this hotfix only).**
**Live:** **1.0.46.2** (11 Nov 23:34 Adelaide; Worker `20bfca7d-e918-46e6-b174-d6c5d405dae1`; commit `ba45941`, build `1.0.141 · ba45941`; no migration; health ok). Before: **1.0.46.1** (10 Nov 23:47; Worker `1eed7a08-4d74-4ee0-8ca1-15c19a41931c`; commit `d42aeb9`, build `1.0.139 · d42aeb9`; no migration; health ok; owner live check ✅). Before: **1.0.46** (8 Nov; Worker `050816b7-1d2f-4a3f-88ad-bf8c0c303901`; commit `7a4a88d`, build `1.0.137 · 7a4a88d`; migrations 0035–0037 applied; health ok; owner quick check ✅, Rina tests on the evening of 8 Nov). Before: **1.0.45.1** (27 Oct 00:35; Worker `7f46d6fc-6877-48a5-bd11-ddf3ce44db76`; commit `e68760e`, build `1.0.134 · e68760e`; health ok, live sign-in shows the new wording, no console errors). Before: 1.0.45 (`e711941c-15be-4e78-ba20-8c1430562942`), 1.0.44.3 (`15ad732a-132e-4503-b70d-5214d820b3d1`), 1.0.44.2 (`70e17010…`), 1.0.44.1 (`8e7bca61…`), 1.0.44 (`5c5ee9c4…`). Backups: `backups/shaggybobo-2026-11-11.sql` (before 1.0.46.2; 104 orders; only ECN-VZ7 "Bshsh" unconfirmed), `backups/shaggybobo-2026-11-10.sql` (before 1.0.46.1; 101 orders; Rina = 1 account in DellaVee + Onde Onde, 2 passkey devices), `backups/shaggybobo-2026-11-08.sql` (before 1.0.46; 97 orders, no open menus), `backups/shaggybobo-2026-10-27.sql` (before 1.0.45.1; 90 orders, DellaVee: Rina = 1 owner, 2 devices, both passkey), `…-26.sql` (before 1.0.45), `…-25.sql`, `…-25-b.sql`.
**Branch:** `main`; tags `v1.0.45`, `v1.0.45.1`, `v1.0.46`, `v1.0.46.1`, `v1.0.46.2`.

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

## Hotfix 1.0.46.2 = plans 129 + 130 (live 11 Nov, Worker `20bfca7d`)
Plan + rulings: `docs/plans/129-send-on-whatsapp.md`; mock-up `uxDesign/customer/mockups/129-send-on-whatsapp.html`. Customers ordered but never sent WhatsApp, so the seller (no phone numbers) could not confirm; order ECN-VZ7 had the name "Bshsh".
- Last checkout step: amber "Next you send your order on WhatsApp…" + **Place order & send on WhatsApp** (opens WhatsApp right after placing); Order placed "Almost done"; reminder cards on the menu's first page and the order page, "⚠ Send on WhatsApp" in My orders, until the seller confirms or ticks WhatsApp received; no more "sending is optional".
- "You can change or cancel until …" hidden; customer change/cancel allowed until a **fixed 6 pm (kitchen time) the day before cooking**, server-enforced (`changes_closed`); kitchen setting for that time = next ("tomorrow").
- Customer first name: at least 2 letters and a vowel (app + server); seller-entered orders unchanged.
- **Plan 130, auto-cancel:** the hourly job cancels **customer** orders still Ordered, WhatsApp not received, 24 h after they were placed (counted from the later of the order time and **AUTO_CANCEL_SINCE = 12 Nov 00:00 Adelaide**, so nothing old is cancelled at deploy); reason shown to seller and customer; "⚠ Cancels at …" tag in the last 2 h; **Restore order** (also ticks WhatsApp received, so never again). Never: seller-entered, private, confirmed, sample orders.
- Seller "Can change" row: "Yes, until <Sat 6 pm> or until you lock it".
- `RELEASE_HOTFIX = 2` (version 1.0.46.2). Owner: "work unattended till ready to deploy" → stopped before commit, push and deploy.
- **Checks:** typecheck, lint, format ✅; selected unit (customer-menu, customer-orders, seller-orders, api, app, components, shared) + server mocks ✅; Playwright: order-flow + customer-batch1 (iPhone), customer-batch2, p129, p105, seller-batch1 (phone), p105, seller-batch1, p130 (desktop) ✅; Android phone emulator on **Haiku** (`scratch/emu-1462/`) ✅ all steps.
- **Deploy impact: low-medium.** Worker + client, **no migration**; deploy Worker and client together (the restore route and `changes_closed` need the new Worker). From 13 Nov 00:00 the job starts cancelling unconfirmed customer orders; tell Rina to confirm real orders (or tick WhatsApp received) in time.
- **Deploy steps:** backup → `pnpm build` (1.0.46.2, no draft) → no migration → `pnpm run deploy -- --tag v1.0.46.2 --message "1.0.46.2: send on WhatsApp reminders, 6 pm change rule, name check, auto-cancel after 24 h"` → health → tag `v1.0.46.2` + push.
- **Deploy note (11 Nov):** four deploys failed with Cloudflare `10021` "binding DB of type d1 failed to generate" (12:46–12:57 UTC; same config as the good deploys; not the "local-only" preview id, not login, not wrangler 4.158 vs 4.160). A Fable check found nothing on our side; ~30 min later `pnpm run deploy` worked unchanged. If it happens again: wait and retry; don't change the D1 config.
- Notes: e2e specs that change/cancel orders fail between Fri 18:00 and midnight Adelaide (the new deadline vs. the sample menus on the coming Saturday); the seller-side deadline uses Australia/Adelaide (the seller store has no kitchen time zone yet); unused `FooterNote` / `order.yourTime` left in place.

## Hotfix 1.0.46.1 = plans 127 + 128 + 3 small items (live 10 Nov, Worker `1eed7a08`)
- **Plan 127, delivery days from the seller phone:** the phone read-only menu (owner, menu not finished, Delivery on) gets a **Delivery days** 2×2 grid (full dates, ＋ dotted / ✓ green / blue + 🔒 default), the default bottom sheet, "Keep the menu open 1 more day", and a Save / Discard bar (nothing saves on tap). Same route as the tablet.
- **Collapsed tablet menu:** tapping the logo opens the kitchen list when the person has 2+ kitchens (Rina could not switch back from Onde Onde); **no ⇄ Switch person in the collapsed menu** (its warning was a tooltip, a second tap signed Rina and the owner out).
- **Sign-in hint** under "Sign in with your screen lock": "Your tablet or phone asks for its own fingerprint, face or the PIN you unlock it with." (Rina did not know "Use PIN" means the tablet's PIN.)
- **Plan 128, backup password:** Settings → Devices → "Backup password · Not set / Set" → Add / Change (phone: full-screen form, Save in the top bar); new `PUT /api/auth/password` (full session, rate-limited, no old password needed); `PASSWORD_MIN` 10 → **8** everywhere.
- Version label **1.0.46.1** (`RELEASE_HOTFIX = 1`); no new release note (hotfix).
- **Checks:** typecheck, lint, format, docs ✅; unit 2,400 + server 737 ✅; directed e2e: p127 + p126 (36), seller-auth (10, both auth projects), session-flow, helper-flow ✅; Android emulator Pixel_9 + Tablet_11 (`scratch/emu-1461/`) ✅; captures `scratch/cap-127/`, `scratch/cap-128/`.
- **Deploy impact: low.** Worker + client, **no migration**. Old clients ignore `hasPassword`.
- **Deploy steps:** backup → `pnpm build` (version label 1.0.46.1) → no migration → `pnpm run deploy -- --tag v1.0.46.1 --message "1.0.46.1: phone delivery days, backup password, collapsed-menu fixes"` → health → tag `v1.0.46.1` + push.
- Findings (not fixed): on a brand-new browser the sign-in screen has no "Use password instead" until the kitchen is known (open the kitchen link first); after switching kitchens the collapsed-rail logo may still show the old kitchen's picture; phone More "Sign out" sits under the tab bar until scrolled. With the tablet menu **open** and a one-person kitchen, no "Signed in as …" shows anywhere (`SellerLayout.tsx` `nameShownElsewhere` assumes the rail shows it).

## 1.0.46 = plan 126, delivery on another day (live 8 Nov, Worker `050816b7`)
For DellaVee's event **Sun 15 Nov**. Plan + all owner rulings: `docs/plans/126-delivery-another-day.md`; mock-up `uxDesign/seller/mockups/126-delivery-another-day.html`.
- **Seller (tablet, menu Details, also while live):** "Delivery days" band: 2 days before, the event day (soft blue), 1 day after; tick any; 🔒 = the default customers see first, tap it for the "Default delivery day" sheet; the event day can be unticked once another day is the default; amber warning for the day 2 before. "Keep the menu open 1 more day" switch for every menu (finish = midnight after the latest delivery day, +1 day when on).
- **Customer:** "Delivery day" chips directly under Pickup/Delivery (default pre-selected); the day on Order placed, the order page, My orders, the checkout summary and the WhatsApp message.
- **Seller:** day tag on orders not on the event day (rows, panel, labels, printed orders, delivery run); Pickup & delivery sorted by day; Delivery day chips in New order and the Change pickup/delivery sheet (orders keep their day if the menu's days change); phone read-only menu lists the days; share post line "Delivery also …".
- **Tidy-ups found on the way (older than 126, fixed):** New order panel padding; wider Details layer in rows (notes stacked, pickup row grid); order rows on shared column tracks (no overlap at larger text); "Orders" title no longer clipped on phones; portrait tablet header/tabs.
- **Migrations (add-only, before the Worker):** `0035_delivery_days.sql` (`menus.extra_delivery_days`, `orders.handover_date`), `0036_default_delivery_day.sql`, `0037_finish_extra_day.sql`. Applied locally. Old clients send no day (= default), old menus have none (= today).
- **Version:** `RELEASE_VERSION = '1.0.46'`, `RELEASE_HOTFIX = null`; release note approved by the owner with "rentang" in the Indonesian text (8 Nov).
- **Checks (final, 8 Nov):** typecheck, lint, format, docs ✅; unit 2,384 + server 733 ✅; 16 directed e2e runs ✅ (p126-delivery-day 7, p126-layout 20, p083, seller-menu, label-print, seller-saturday, order-flow, p071-address, p105, archived-orders, seller-batch1 + seller-batch2 on desktop and phone, batch2-flow, seller-about); Android emulator 2 rounds (Tablet_11 + Pixel_9, `scratch/emu-126/`, `scratch/emu-126b/`) ✅ with the found tidy-ups fixed; captures `scratch/cap-126/final-*`.
- **Deploy impact: medium-low.** Three add-only migrations, applied before the Worker. A menu without delivery days behaves exactly as today.

**Deploy steps 1.0.46 (owner runs them, one at a time):**
1. Owner approves the release note text, then commit on `main` + push.
2. Backup: `pnpm exec wrangler d1 export shaggybobo-order --remote --output backups/shaggybobo-2026-11-08.sql`
3. `pnpm build` (version 1.0.46, no "draft")
4. **Migrations first:** `pnpm exec wrangler d1 migrations apply shaggybobo-order --remote` (0035, 0036, 0037)
5. `pnpm run deploy -- --tag v1.0.46 --message "1.0.46: delivery on another day"`
6. Health: `curl https://order.shaggybobo.app/api/health`
7. Live check: DellaVee tablet → edit the 15 Nov menu → Delivery days → tick the days → Save; customer phone → basket → Delivery → pick a day → order; seller sees the day tag and the label.
8. Tag `v1.0.46` + push.

## Hotfix 1.0.45.1 = plan 125 (live 27 Oct 00:35, Worker `7f46d6fc`, deployed by Claude with the owner's one-time OK for this hotfix only)
Why: Rina could not see the refresh bar (the app only checked on open), and later both her devices were signed out: she had only a forgotten password, most likely after tapping **Switch person** (one tap, no question). Back in through a recovery key (= a new owner account, D-090) and the 6-digit code; the owner removed her old accounts. Details and all rulings: `docs/plans/125-update-check-while-open.md`.
- **Version with the hotfix number:** `RELEASE_HOTFIX = 1` in `shared/release.ts`, `versionLabel()` → "Version 1.0.45.1" in About, Settings, the tablet rail (also sign-in and admin footers) and a muted line at the bottom of the phone More screen. `RELEASE_VERSION` stays 1.0.45, so What's new does not pop again. **Next hotfix: bump `RELEASE_HOTFIX`; next release: set it back to `null`.**
- **Update check:** no timer; automatic check on open / return to the screen at most every **10 minutes**, last check saved in localStorage (`updateLastCheck`). About checks by itself when opened (like Chrome) + **Check for update** (newer → reload; same → "You have the newest version"; error → "Could not check").
- **Sign-out fixes:** Switch person only on the tablet and only when the kitchen has **2+ people** (`Me.people`, one COUNT on memberships), with "Tap again"; phone Sign out "Tap again"; "Signed in as" kept on the phone; wording "Sign in with your screen lock (fingerprint, face or PIN)"; Devices: "Remove device" + warning; Devices and admin People show screen lock / password per device and "never finished setting up".
- **Admin People bug:** a members list asked earlier arrived after the post-remove reload and overwrote it; fixed with a newest-ask-wins counter (`SellerDetails.tsx`).
- **Checks:** lint 0, format ✅, unit 3,065 (Miniflare `fetch failed` / EADDRINUSE flakes pass serially: 760/760), full e2e **130 passed / 46 skipped by project** (2 stale specs updated: About "Version", phone banner size text from 1.0.44.1), Android emulator (`scratch/emu-125/`): More, About, Devices, sign-in EN/ID ✅; About layout fixed for phones after the emulator round; tablet Switch person checked by unit tests only.
- **Deploy impact: low.** Client + Worker, no migration. New optional API fields (`people`, `signIn`, `passkeys`, `unfinished`); old clients ignore them.
- **Owner live check:** on a phone open About → "Version 1.0.45.1" → Check for update → "You have the newest version". More: no Switch person, Sign out asks "Tap again".

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
- ID text "…ponsel ini ini" on the phone More (contacts block): `seller-orders` id.json `"phone": "ponsel ini"` is put into a sentence that already ends in "ini". Older than 1.0.45.1; fix later.
- Admin "Pause the kitchen" signs everyone out; worth a stronger warning one day.
- 1.0.43.3: one-off blank banner on an iPhone cold start, not reproduced. Watch.
- Time-bomb leftovers (low): `e2e/p039-captures.spec.ts` resets data without pushing the cut-off; passkey counter ~2033; seed-local data goes stale.
- Unused: `public/guides/template-phone-banner.png` (ask before deleting).
- Scratch copies `scratch/emu-124/state`, `scratch/emu-124b/state` can be deleted.

## Later (owner rulings recorded)
- **1.0.47 candidates:** iOS-style large titles on pages without a banner (mock-up first); plan 116 "Send a problem report" (device log + "What happened?" to the admin); the 6 chef permissions, one at a time.
- Maybe: the tablet Share screen remembers the language like the phone does.
- **Change role** (owner ↔ chef ↔ helper) in seller Settings → Team and/or the admin page (owner 26 Oct: "leave change role later in future plan"; today: remove, then re-invite with the new role). Mock-up first.
- **From plan 126 (owner 8 Nov):** an admin setting per kitchen for the delivery-day range (how many days before/after); a choice of automatic finish time beyond "keep open 1 more day".
- **Small fixes:** Indonesian "…ponsel ini ini" (doubled word) on the phone More contacts block; a stronger warning on admin "Pause the kitchen" (it signs everyone out).
- **v1.1.0 (analysis only):** plans 082/098/099 (store, kinds, separate deployments).
- Older open owner checks: 1.0.42 live checks, 1.0.38 pickup map + QR scan, a real label print.

## Local tips
- **Node 24.22.2** (nvm-windows; was 22.23.3, missing the Oct 2026 security fixes) and pnpm 12.10.1, since 8 Nov. Dev tools updated the same day; `pnpm audit`: 1 moderate left (minimatch inside eslint, dev-only; forcing minimatch 11 breaks eslint). Pins in `pnpm-workspace.yaml`: undici ^8.12.2, zod ^4.6.6.
- Playwright with `--no-deps` needs `NODE_EXTRA_CA_CERTS="C:/Users/Indra/AppData/Local/mkcert/rootCA.pem"` (else "unable to verify the first certificate"); specs pick their own project (`order-flow`/`batch2-flow` on `iphone-chromium`, desktop parts on `desktop-chromium`); one Playwright run at a time. Lint needs `NODE_OPTIONS=--max-old-space-size=8192`. `mocks` and `sellerAuth` tests: `--no-file-parallelism` (Windows port exhaustion).
- Android emulator: `D:\Android\sdk\emulator`; AVDs Pixel_9 (`-memory 4096`), Pixel_8a, Tablet_11; `adb reverse` + mkcert CA installed; PIN 1234. Dev API writes from scripts need an `Origin: https://localhost:<port>` header.
- iPhone: a home-screen app reads the head only at "Add to Home Screen" (lesson 44); iOS 26 blurs under the status bar (lesson 45).
- Passkeys don't work on the LAN-IP dev URL; use `https://localhost:5173`. Wrangler auth error 10000 → `wrangler login` (or set a `CLOUDFLARE_API_TOKEN`).

## Next session
1. **Rina:** confirm real orders as they come in (from 13 Nov 00:00 unconfirmed customer orders are auto-cancelled 24 h after they were placed; ECN-VZ7 "Bshsh" will be); add her backup password; the 15 Nov event.
2. **Kitchen setting for the customer change/cancel time** (owner: "tomorrow we can add simple setting"; now fixed 6 pm the day before, `CUSTOMER_CHANGE_HOUR`), mock-up first.
3. Then pick from "Later", one question at a time.

## Ready prompt for the next session
> Read docs/HANDOVER.md, CLAUDE.md and docs/guide/agent-working-conventions.md. Live is 1.0.46.2 (tag v1.0.46.2, Worker 20bfca7d). Start with "Next session" in the hand-over, one question at a time. Ask the owner before any git write.
