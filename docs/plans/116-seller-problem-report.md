# 116 · Seller "Send a problem report"

**Status:** idea, owner 20 Oct "Ok" to plan it for **after 1.0.44**; not approved for building.

## Today
Both apps already send scrubbed error entries to the server (plan 026, `src/api/clientLog.ts`, table `client_log`: newest 500, admin can view and clear). No names, notes, order codes, tokens, IPs or cookies (D-007).

## Idea (option 1 of 3, recommended)
- The seller app keeps a **rolling log on the device** (about the last 200 events): errors, slow or failed requests (with how long they took), the screen and the button tapped. Scrubbed the same way as `clientLog` (no customer names or notes).
- Help or About gets **"Send a problem report"** with a short "What happened?" box; it sends the log + text to the server once, with a size limit, and the admin sees it as one report.
- Pairs with plan 114 (slow networks): a report shows where a slow tablet got stuck.

## Rejected for now
- Send the log by WhatsApp ("Copy report"): long text, hard to read on a phone.
- Log every slow request automatically: noisy, fills the 500-entry ring.

## Questions for later
Who sees reports (admin only?), how long they are kept, and whether customers get it too.
