# 130 · Cancel customer orders not confirmed within 24 hours

**Target: hotfix 1.0.46.2** (with plan 129; owner 11 Nov: "A for the auto-cancel, and do it as part of hotfix"). **Status:** mock-up `uxDesign/seller/mockups/130-auto-cancel.html`; building unattended (owner: "work unattended till ready to deploy").

## Why
Fake or forgotten orders (e.g. ECN-VZ7, name "Bshsh") stay "Ordered" for ever because the customer never sends the WhatsApp message, and the seller has no number to ask. Owner: "order that has not been confirmed within 24 hrs, we can delete or mark it as cancelled, so the seller can see it as cancelled with reason."

## Rules (owner "A")
- **Who:** customer-placed orders only, still **Ordered** (not confirmed), **WhatsApp received not ticked**, not cancelled, **24 hours after they were placed**. Never: seller-entered orders, private orders, restored orders.
- **When:** the existing hourly background job.
- **What:** status → Cancelled, with the reason "Not confirmed within 24 hours (no WhatsApp message)", recorded in the order's change history as done by the app; the customer's order page and My orders show it as Cancelled with a plain reason (EN/ID). Cancelling deletes the delivery address as today.
- **Warning:** in the last 2 hours the seller's list shows "⚠ Cancels at <time>" on the order.
- **Undo:** the cancelled order shows **Restore order** for the seller; it returns to Ordered and is never auto-cancelled again.

## Stages
| # | what | proof |
|---|---|---|
| 1 | hourly job + reason + restore + seller tag + customer text, EN/ID | unit + mocks: cancels exactly the right orders at 24 h, skips seller/private/confirmed/WA-received/restored, restore works; tag in the last 2 h |
| 2 | captures (seller tablet + phone, customer phone), directed specs | screenshots looked at, logs |

**Deploy impact:** Worker + client; no migration if the restore mark can live in the order's change history (else one add-only column, applied first).
