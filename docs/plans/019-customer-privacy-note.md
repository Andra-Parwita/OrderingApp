# 019 · Customer app: "About and privacy" in Settings

**Status:** proposed for after the demo (2026-10-10, builder: "on customer app we may add a note, 'about' or in settings, to show how we consider privacy etc .. not now but next after demo"). Its wording needs the owner's review before building.
**Goal:** customers can read, in plain EN and ID, what the app keeps about them and for how long, so they can trust it.

## Draft content (to check against the code before building)
- **What we keep:** your first name, your order (dishes, pickup or delivery, note) and your language. Kept with the kitchen you ordered from.
- **What we never keep in the cloud:** your phone number and your address. You send those to the seller on WhatsApp, and they stay on the seller's phone (D-007, D-059).
- **On this phone:** your orders list, your first name for the next order, and your language and theme, in this browser only. Clearing the site data removes them.
- **Notifications:** only if you allow them, only for that order, and removed when the order is finished or cancelled.
- **How long:** order details are deleted 4 weeks after the cooking day (D-027/D-044).
- **Find my order:** wrong tries keep a scrambled form of your internet address for about an hour, to stop guessing (D-075).
- **No accounts, no ads, no tracking cookies, no payments in the app.**
- Who runs it: "ShaggyBobo's Order", with a contact line set by the owner.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **"About and privacy" row in customer Settings**, opening a page with the text above (EN/ID), plus the app version. Each point is checked against the code first (retention job, push pruning, the lookup sweep). | `src/features/customer-settings/`, the i18n | the owner approves the wording; a test that the page opens in both languages |

## End of phase
- [ ] typecheck · lint · format · customer-settings tests
