# 043 · A friendly invite message, in English or Indonesian

**Status:** approved (2026-10-11, owner: "A", in this round; "we don't need to re-run all tests, just the preselected tests that may be impacted").
**Goal:** when the admin sends a seller invite, or the owner sends a chef or helper invite, the WhatsApp message has a short welcome and steps, in the language the sender picks for that message (EN or ID), independent of the page's language. It is shown as an editable preview before sending.

## The message (EN; ID is the same, translated)
> Hi <name>! 👋 You're invited to run **<kitchen>** on ShaggyBobo's Order, the app for taking your weekly food orders.
> 1. Open this link on the phone or tablet you'll use: <link>
> 2. Save the passkey when your phone asks (Face ID, fingerprint or PIN).
>
> The link works once, on one device, within 24 hours.

For a chef or helper: "You're invited to join **<kitchen>** as a chef / helper …". With no name typed: "Hi! 👋 …".

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Admin seller invite.** In the key box (`src/features/admin/KeyBox.tsx`): an EN / ID choice for the message (default: the page language), a preview text area with the message (editable), "Send on WhatsApp" sends the preview's text, "Copy message" copies it. "Copy link with key" stays. Both languages' message texts live in the admin i18n files and are read with an explicit language (`i18n.getFixedT(lang)`). | `src/features/admin/KeyBox.tsx`, admin i18n | unit: switching to ID shows the Indonesian message while the page stays English; an edit is what WhatsApp gets; the link is inside |
| 2 | **Team invites.** The same choice, preview and sending in the owner's chef/helper invite (`src/features/seller-setup/InviteBox.tsx`), with the role in the wording. | `src/features/seller-setup/InviteBox.tsx`, seller-setup i18n | unit: a helper invite in ID reads "Asisten"; the link is inside |
| 3 | **Invite list on the admin page only** (owner: "for now just in admin page, to make it simple, just a list, make sure to show maybe the last 10 or 20 invitations only"). On the seller's **Invitations** tab: the newest **20** invites of that kitchen (seller, chef and helper keys alike): name, role, sent, and status: waiting (expires …), used (when), or expired. Read-only; no cancel. The key itself is never shown again (it's stored hashed). Server: `GET /api/admin/sellers/:id/invites` (admin only, newest 20). | `worker/db/auth.ts`, `worker/api/authRoutes.ts`, `shared/authContract.ts`, `src/api/auth.ts`, `src/features/admin/`, admin i18n | tests: waiting / used / expired each show right; only 20; a seller gets 403 |

## End of phase
- [ ] typecheck · eslint · unit tests of `src/features/admin` and `src/features/seller-setup`
- [ ] only the impacted e2e specs, one at a time with `--no-deps`: `admin` (auth project) and `seller-setup` (settings project)
