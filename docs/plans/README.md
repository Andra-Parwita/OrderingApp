# Plans

Every change starts here as a plan ([D-055](../decisions/README.md)). One file per plan, named `NNN-short-name.md` (for example `001-seller-share.md`). The owner approves a plan before any building starts.

- **Who builds:** the owner plans (from the design in `uxDesign/`) with the coordinator; the owner's son executes the plans on his own PC. So each plan must stand on its own: quote the rulings it relies on, name the files, and say what "done" looks like.
- **During the stages:** run typecheck only.
- **At the end of the phase:** run the full gate once (lint · format:check · test · the changed Playwright specs). See [tech-stack.md](../guide/tech-stack.md#quality-gate).

What is running now, with agents and times: [live-status.md](live-status.md).

The long-range [roadmap](../plan/roadmap.md), the live [board](../plan/board.md) and [lessons](../plan/lessons.md) stay in `docs/plan/`.

## Next, in order (2026-10-11)

From a read-only analysis of the unfinished plans. **The owner took over all of it on this PC (2026-10-11)**, on `indra/brand_logo_ux`, which is rebased on the son's `plan/flow-and-prototype`. When it's done it merges back to `main`, and the son pulls and deploys. Until then the son pauses building, so there are no conflicts.

| track | order | note |
|---|---|---|
| **Server and kitchen** (was the son's; after the UI waves, or alongside them on separate files) | 028 → 030 → 029 → 032 stages 3–4 → 031 | **028 stage 1 is out of date after 033**: it says `chefs.kind` and "`Me` carries kind", but 033 rebuilt accounts and memberships (`migrations/0007_people.sql`). Re-plan its contract line first. 032 stage 1 is already done in 033. |
| **This PC** (AI builders, at most 3 at once) | wave A: 039 stages 2–3 (Home) · 038 · 024 → wave B: 039 stages 4–5 · 037 stage 1 · 026 → wave C: 037 stages 2–3 · 026 stage 4 | Home before the wizard layer: Home opens the wizard as a page until 037 lands. 037 and 039 never run at the same time (both edit `AppRoutes.tsx`). |

**After this deploy (owner, 2026-10-11):** the **customer app** gets its own next plan (with the Lottie animations the owner will send). Also waiting: 031 as a read-only "view as"; Send reminder and Download CSV on Orders; the stall's on-the-day counts in the printed totals (042); paging for the admin's invite list (043 shows the newest 20); **the same invite list for the seller** in Settings → Team, with paging; and **keep at most the last 50 invites per kitchen** (older ones pruned, so storage never grows without limit) (owner, 2026-10-11). And **graceful network and refusal handling** (owner): a refused or failed request is never repeated without end; one shared rule for retries (a few, with growing waits, only for network errors and 5xx, never for 401/403/4xx), a calm "offline / try again" state on screen, and polling that stops or slows when the server refuses.

**Migration numbers:** all work is now on this PC, so each plan takes the next free number when it is built (no gaps, so they apply in order everywhere).
**Rebase:** 038 changes `AdminHomeScreen.tsx`, which 028, 031 and 032 also edit. The son rebases after wave A.

## Plans

✅ done · ⬜ not done yet · ➖ replaced (details in the status column)

| # | done | plan | status |
|---|---|---|---|
| 001 | ✅ | [Seller app UX redesign](001-seller-ux-redesign.md) | done (2026-10-10); owner check pending |
| 002 | ➖ | [Web push notifications](002-web-push.md) | replaced by 004 (builder: "A", 2026-10-10) |
| 003 | ✅ | [Phase 4 follow-ups](003-phase4-followups.md) | done (2026-10-10) |
| 004 | ✅ | [Customer app redesign and web push](004-customer-redesign-and-push.md) | done (08:46); device checks pending |
| 005 | ✅ | [Code-review fixes](005-review-fixes.md) | done (06:11) |
| 006 | ✅ | [Security fix: image refs stay with their seller](006-security-image-refs.md) | done (06:30) |
| 007 | ✅ | [Harden the 6-digit add-device code](007-auth-code-hardening.md) | done (06:49) |
| 008 | ✅ | [Seller orders: 50 samples, only the list scrolls](008-seller-list-scroll.md) | done (09:06) |
| 009 | ✅ | [Customer: lost order back, remembered name, kitchen icon](009-order-recovery-name-icon.md) | done (09:23) |
| 010 | ✅ | [Order lookup: review fixes before Cloudflare](010-order-lookup-fixes.md) | done (09:58) |
| 011 | ✅ | [Kitchen icon and manifest in the page itself](011-kitchen-icons-at-the-edge.md) | done (10:33) |
| 012 | ✅ | [Ready for a real test on Cloudflare](012-cloudflare-ready.md) | config done; deploy pending (10:33) |
| 013 | ✅ | [Demo kitchen: samples on the real server](013-demo-kitchen.md) | done (10:33) |
| 014 | ✅ | [Orders home: collapse the banner](014-orders-banner-collapse.md) | done (11:14) |
| 015 | ✅ | [Orders home: one-row header and buttons, Dishes slide-over](015-orders-compact-and-dishes-slideover.md) | done (11:31) |
| 016 | ✅ | [Kitchen: filter by chef](016-kitchen-chef-filter.md) | done (11:17) |
| 017 | ✅ | [Settings: the customer link, copy, share and QR](017-settings-customer-link.md) | done (11:21) |
| 018 | ✅ | [Seller: scan the customer QR to hand over](018-scan-customer-qr.md) | done (11:48); real-device camera check pending |
| 019 | ✅ | [Customer: About and privacy](019-customer-privacy-note.md) | done (11:44); ID wording needs a native check |
| 020 | ✅ | [App version on every deploy](020-app-version.md) | done (11:48) |
| 021 | ✅ | [Seller: notice new orders while the app is open](021-seller-new-order-alert.md) | done (12:28) |
| 022 | ✅ | [Orders header: nothing overlaps on the iPad](022-orders-header-fit.md) | done (12:00); narrow-portrait list follow-up open |
| 023 | ✅ | [Text size: smaller, normal, larger](023-text-size.md) | done (2026-10-11); not deployed |
| 024 | ✅ | [Customer pages show the current kitchen theme from the first paint](024-customer-theme-first-paint.md) | done (2026-10-11); not deployed |
| 025 | ✅ | [Add a device: use the existing passkey or password](025-add-device-existing-login.md) | done (12:28); iPad check pending |
| 026 | ✅ | [A small error log sent to the server (last 500)](026-client-error-log.md) | done (2026-10-11); not deployed |
| 027 | ✅ | [Admin access: two people, codes on the admin side, device names](027-admin-access.md) | done (2026-10-10); deploys with 033 (builder) |
| 028 | ✅ | [A Helper role for the kitchen team](028-helper-role.md) | done (2026-10-11); not deployed |
| 029 | ✅ | [Selling on the day: stock, sales log, end-of-day summary](029-on-the-day-selling.md) | done (2026-10-11); not deployed |
| 030 | ✅ | [Chefs add and edit their own dishes](030-chef-own-dishes.md) | done (2026-10-11); not deployed |
| 031 | ⬜ | [Admins open a kitchen as its owner would](031-admin-views-kitchen.md) | postponed (2026-10-11, owner): not in this deploy; read-only view first if it returns |
| 032 | ✅ | [Invite links, single-use keys, pausing a kitchen](032-invite-links-and-pause.md) | done (2026-10-11); not deployed |
| 033 | ✅ | [People and memberships: one kitchen passkey, switcher, invite links](033-people-and-memberships.md) | done (2026-10-11); not deployed; screenshots to approve |
| 034 | ✅ | [Kitchen: "who ordered this dish" panel](034-kitchen-who-ordered.md) | done (2026-10-11); not deployed |
| 035 | ✅ | [Kitchen and Pack on the phone, shared progress, labels never cut](035-kitchen-on-phone-and-labels.md) | done (2026-10-11); not deployed |
| 036 | ✅ | [ShaggyBobo branding on admin and seller first set-up](036-developer-branding-sign-in.md) | done (2026-10-11); end gate pending |
| 037 | ✅ | [Menu wizard as a layer over the current screen](037-menu-wizard-overlay.md) | done (2026-10-11); not deployed |
| 038 | ✅ | [Admin page in two panels, sellers expand and collapse](038-admin-two-panels.md) | done (2026-10-11); not deployed |
| 039 | ✅ | [Seller Home: a summary of the current menu](039-seller-home.md) | done (2026-10-11); not deployed |
| 040 | ✅ | [The seller's top band: wide banner that fills, matched to the left menu](040-top-band-banner.md) | done (2026-10-11); not deployed |
| 041 | ✅ | [The admin sets a kitchen's images](041-admin-sets-kitchen-images.md) | done (2026-10-11); not deployed |
| 042 | ✅ | [Print the current menu's orders on A4](042-print-orders-a4.md) | done (2026-10-11); not deployed |
| 043 | ✅ | [A friendly invite message, in English or Indonesian](043-invite-message.md) | done (2026-10-11); not deployed |
| 044 | ✅ | [The new ShaggyBobo mascot and logo icon](044-new-mascot-and-logo.md) | done (2026-10-11); not deployed |

**Later, when the builder says so:** Cloudflare security insights: add `/.well-known/security.txt` (needs a public contact email), try Bot Fight Mode (check that WhatsApp link previews still work), AI Labyrinth (optional).

## Template

```markdown
# NNN · <name>

**Status:** draft | approved | building | done (YYYY-MM-DD)
**Goal:** <one or two sentences: what the owner will see when it's done>

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | <what> | <files / folders> | <how we know; typecheck passes> |
| 2 | ... | | |

## End of phase

- [ ] Full gate: typecheck · lint · format:check · test · changed Playwright specs
- [ ] Owner tries it on the PC (and a phone, if it's customer-facing)

## Decisions and notes

- <rulings made while planning, linked to docs/decisions>
```
