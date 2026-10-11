# Plans

Every change starts here as a plan ([D-055](../decisions/README.md)). One file per plan, named `NNN-short-name.md` (for example `001-seller-share.md`). The owner approves a plan before any building starts.

- **Who builds:** the owner plans (from the design in `uxDesign/`) with the coordinator; the owner's son executes the plans on his own PC. So each plan must stand on its own: quote the rulings it relies on, name the files, and say what "done" looks like.
- **During the stages:** run typecheck only.
- **At the end of the phase:** run the full gate once (lint · format:check · test · the changed Playwright specs). See [tech-stack.md](../guide/tech-stack.md#quality-gate).

The long-range [roadmap](../plan/roadmap.md), the live [board](../plan/board.md) and [lessons](../plan/lessons.md) stay in `docs/plan/`.

## Plans

| # | plan | status |
|---|---|---|
| 001 | [Seller app UX redesign](001-seller-ux-redesign.md) | done (2026-10-10); owner check pending |
| 002 | [Web push notifications](002-web-push.md) | replaced by 004 (builder: "A", 2026-10-10) |
| 003 | [Phase 4 follow-ups](003-phase4-followups.md) | done (2026-10-10) |
| 004 | [Customer app redesign and web push](004-customer-redesign-and-push.md) | done (08:46); device checks pending |
| 005 | [Code-review fixes](005-review-fixes.md) | done (06:11) |
| 006 | [Security fix: image refs stay with their seller](006-security-image-refs.md) | done (06:30) |
| 007 | [Harden the 6-digit add-device code](007-auth-code-hardening.md) | done (06:49) |
| 008 | [Seller orders: 50 samples, only the list scrolls](008-seller-list-scroll.md) | done (09:06) |
| 009 | [Customer: lost order back, remembered name, kitchen icon](009-order-recovery-name-icon.md) | done (09:23) |
| 010 | [Order lookup: review fixes before Cloudflare](010-order-lookup-fixes.md) | done (09:58) |
| 011 | [Kitchen icon and manifest in the page itself](011-kitchen-icons-at-the-edge.md) | done (10:33) |
| 012 | [Ready for a real test on Cloudflare](012-cloudflare-ready.md) | config done; deploy pending (10:33) |
| 013 | [Demo kitchen: samples on the real server](013-demo-kitchen.md) | done (10:33) |
| 014 | [Orders home: collapse the banner](014-orders-banner-collapse.md) | done (11:14) |
| 015 | [Orders home: one-row header and buttons, Dishes slide-over](015-orders-compact-and-dishes-slideover.md) | done (11:31) |
| 016 | [Kitchen: filter by chef](016-kitchen-chef-filter.md) | done (11:17) |
| 017 | [Settings: the customer link, copy, share and QR](017-settings-customer-link.md) | done (11:21) |
| 018 | [Seller: scan the customer QR to hand over](018-scan-customer-qr.md) | done (11:48); real-device camera check pending |
| 019 | [Customer: About and privacy](019-customer-privacy-note.md) | done (11:44); ID wording needs a native check |
| 020 | [App version on every deploy](020-app-version.md) | done (11:48) |
| 021 | [Seller: notice new orders while the app is open](021-seller-new-order-alert.md) | done (12:28) |
| 022 | [Orders header: nothing overlaps on the iPad](022-orders-header-fit.md) | done (12:00); narrow-portrait list follow-up open |
| 023 | [Text size: smaller, normal, larger](023-text-size.md) | approved (11:47); after 020 and 021 |
| 024 | [Customer pages show the current kitchen theme from the first paint](024-customer-theme-first-paint.md) | approved (11:49); after 021 and 023 |
| 025 | [Add a device: use the existing passkey or password](025-add-device-existing-login.md) | done (12:28); iPad check pending |
| 026 | [A small error log sent to the server (last 500)](026-client-error-log.md) | approved (12:15); after 025 |
| 027 | [Admin sign-in: an empty left panel](027-admin-sign-in-panel.md) | replaced by 028 |
| 028 | [ShaggyBobo branding on admin and seller first set-up](028-developer-branding-sign-in.md) | done (2026-10-11); end gate pending |

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
