# 111 · Square payments: discovery note

**Status:** approved (2026-10-20, builder "A": stages 0–2; stage 3 is a later plan). Phase 0 findings, stages and decisions below. Q1–Q9 answered; the team's brief is [111-square-brief.md](111-square-brief.md), on branch `plan/square-payments`. The roadmap's direction 1 ([product/roadmap.md](../product/roadmap.md)): "customers pay when they order (card, Apple Pay / Google Pay) through Square; the seller sees 'paid' on the order; refunds on cancel." Per the roadmap, a discovery note first (who pays, how, the open questions), then a plan with stages; no code until the owner approves the plan (D-055).

## What is already decided or designed
- **Payments are a kitchen setting, not a fork** (roadmap, "How we'll approach them").
- **Where it plugs in** ([098](098-extensible-core.md)): one table `order_payments (seller_id, order_id, provider, provider_ref, amount_cents, state, created_at)`, `paid` derived from it, no provider columns on `orders`; payment belongs to the Order, so menu, store and private orders all get it. Existing hooks: `orders.paid`, `orders.deposit_cents`, the Paid tick, the audit entry `paid`, `past_weeks.paid_cents / unpaid_cents`.
- **Bigger store** ([099](099-bigger-store-analysis.md)): GST on receipts and partial refunds come with this plan.

## Answers so far
| # | question | answer |
|---|---|---|
| Q1 | When does the customer pay? | **At order** (builder, 2026-10-20: "A for now"); each kitchen can switch payments on or off, so a kitchen without Square keeps "pay the seller directly". |
| Q2 | Whose Square account gets the money? | **Each kitchen's own** (builder, 2026-10-20: "A"): Settings → **Connect Square** (Square OAuth) once per kitchen; money goes straight to that kitchen; the app never holds money; Square handles payouts, refunds and fees per kitchen. |
| Q3 | How much is paid online? | **The full order total; no tips, no deposits for now** (builder, 2026-10-20: "A"). "Paid" means fully paid. Tips or deposits can be kitchen settings later. |
| Q4 | Refund on cancel? | **Automatic, full amount** (builder, 2026-10-20: "A"): a seller cancel, or a customer cancel before the cut-off, refunds through Square at once; the order shows "Refunded"; Square emails the customer if they gave an email. |
| Q5 | Receipt? | **B: A plus a GST option** (builder, 2026-10-20: "B, since it's additional features to A"). Square's email receipt when the customer gives an email (optional; the email goes **only to Square**, never into our database, D-007) and a "Paid · $25.00 · card ending 4242" line on the customer's order page. Plus a kitchen setting **"Registered for GST"** (ABN): a tax-invoice page with the ABN and "includes GST" (1/11 of the total). Off by default. |
| Q6 | Who pays Square's fee (about 1.6% online, to be checked)? | **The kitchen** (builder, 2026-10-20: "A"): customers pay exactly the menu prices; no surcharge. |
| Q7 | A paid order changes (seller edit, plan 105, or customer change before the cut-off)? | **Settle the difference automatically** (builder, 2026-10-20: "A"): a lower total refunds the difference through Square at once; a higher total asks the customer to pay the extra before a customer change is saved; after a seller edit the order shows "$6.00 still to pay" and the customer gets a link to pay it. |
| Q8 | How is a card charged at the stall? | **Square Point of Sale handoff** with the seller's existing **Square Reader**, on one designated cashier device (team brief [111-square-brief.md](111-square-brief.md), 2026-10-20). Cash stays, as "cash received". |
| Q9 | Order of work | **Foundation (Connect Square, admin enables per kitchen, then the seller connects) → event POS at the stall → online checkout** (builder, 2026-10-20: "A"; the team: "we will start with on the day event"). Online uses a Square-hosted payment link (brief). |
| Q10 | What is a stall ticket? | **A new kind of order, "stall"** (builder, 2026-10-20: "A"): one per customer at the stall (the team's "own card"); it reuses order codes, QR, labels, history, the Paid badge and end-of-day totals; the customer's name is optional. Needs the orders `kind` check widened (menu, private, stall) in migration 0031. |
| Q11 | Who may press Charge? | **Owner and helpers, only on the one cashier phone** set for the event (builder, 2026-10-20: "A"; brief: "one designated payment device"). Other staff phones build tickets; the cashier phone charges them. |
| Q12 | Refunding a stall card payment? | **In the Square app by the seller**, then **Mark refunded** on the ticket in our app (records it, puts the stock back) (builder, 2026-10-20: "A"). Refund from our app is for later, once Square confirms it works for stall payments. |
| Q13 | What does the admin turn on? | **Two options per kitchen** (builder, 2026-10-20): **Customer payments** (online, when the customer orders; stage 3) and **Event-day payments** (the stall: for example DellaVee selling at a table on the event day; stage 2). Either, both or none. The seller then connects Square and switches on only what the admin allowed. |

## Still open
- Nothing for the owner; details (wording, where Connect Square sits, sandbox) go into the build plan and its mock-ups.
- Q1 (pay at order) now comes **after** the stall (Q9). Q4 (automatic refund) to re-check against the brief: "do not assume cancelling a ShaggyBobo order automatically refunds Square; use the Refunds API when applicable".

## Phase 0 findings (2026-10-20, read-only)

### Square (official docs, checked 20 Oct; links in the research notes)
- **Stall handoff (POS API, mobile web):** supported in Australia, iOS and Android, Square POS app installed. We send **an amount only** (AUD cents) plus `notes` and an echoed reference (`state` on iOS, `REQUEST_METADATA` on Android); **no item list**. The callback returns a transaction id and status. The callback URL must be registered in the Square Developer Console.
- **No Reader needed:** **Tap to Pay** on iPhone/Android works in Australia (phones, not tablets); the A$65 Reader also works.
- **Confirming:** the callback alone is not proof (a redirect can be faked); our server looks the payment up with the seller's token (`PAYMENTS_READ`). The exact lookup call for a POS transaction id is **unverified**.
- **Not testable in Square's sandbox:** the handoff only works in production on a real device; test with the **cash** tender (no money moves). OAuth and online links do have a sandbox.
- **OAuth:** code flow with our server's client secret; access tokens expire after 30 days (renew weekly); refresh tokens last until revoked; `oauth.authorization.revoked` webhook when a seller disconnects in Square.
- **Fees (AU):** in person 1.6%, online 2.2%. Application fees are optional; we take none.
- **Unverified, to prove in stage 0:** return to the **installed home-screen app**; the lookup call; refunding a stall payment by API.

### Our code (what exists, what's missing)
- **Sell screen** (`src/features/seller-saturday/SellScreen.tsx`, `worker/db/daySales.ts`, `/api/seller/day/*`): atomic stock decrement and undo, owner and helper. **A stall sale has no ticket, no customer and no money**: `day_sales` has no amount and no order id.
- **Paid today:** `orders.paid` 0/1 set by `POST orders/:code/paid` (owner/chef); the order write is a whole-row update, so a Square confirmation must not share that path (race with a seller edit). No order totals are stored; they are computed from `order_lines.price_cents`.
- **Admin switches per kitchen** exist (demo, pause in `worker/api/authRoutes.ts`, `src/features/admin/SellerDetails.tsx`): the "payments allowed" switch fits beside them.
- **Secrets** are typed in `worker/api/index.ts` (`ApiEnv`); AES-GCM encryption already exists for addresses (`worker/db/address.ts`): Square tokens use the same pattern with their own key.
- **Inbound routes:** `/api/*` dispatch in `worker/api/routes.ts`; the Origin check covers seller/admin/auth/customer, so a Square callback route needs its own check (OAuth `state`, webhook signature later). Rate limits exist (`authLimits.ts`).
- **Roles:** allow-list per route (`worker/api/sellerRoute.ts`): payment settings owner-only.
- **Live updates:** `stock.changed` / `order.changed` through `SellerLive` already refresh the Sell screen.
- **Nothing Square exists yet;** next migration is **0031**.

## Proposed stages (for approval)

| # | stage | done when |
|---|---|---|
| 0 | **Proof on a real phone (no app changes on the live site).** The owner creates a Square Developer app (owner's account), registers the OAuth redirect and POS Web Callback URLs. A dev-only test page hands off **A$1.00 cash** to Square POS on an iPhone and an Android phone, from Safari/Chrome **and** the installed home-screen app, and our server looks the transaction up. | the return works on both phones (or we know where it doesn't), and the lookup call is known |
| 1 | **Foundation.** Migration 0031: two per-kitchen admin options, `pay_online_allowed` and `pay_event_allowed` (Q13), `square_connections` (merchant, location, encrypted tokens, expiry, status). Secrets: `SQUARE_APP_ID`, `SQUARE_APP_SECRET`, `SQUARE_TOKEN_KEY`. Settings → **Payments**: Connect Square / Connected / Disconnect (owner only); daily token renewal in the existing cron. | a kitchen the admin allowed connects and disconnects its sandbox Square and switches on only the allowed options; another kitchen can't see or use it |
| 2 | **Stall tickets and charging.** Tap dishes into a ticket per customer; **Charge $18.00** holds the stock (10 min) and opens Square POS; on return our server confirms with Square, then **Paid · hand over**; **Cash received** as the other button; an expired or cancelled ticket gives its stock back. A `payments` record per ticket (provider, Square id, amount, state), separate from the order row. | a real stall test on the demo kitchen: card (tap) and cash, a cancelled charge, a lost return reconciled |
| 3 | **Online checkout** (Square-hosted payment link, webhooks, refunds) | a later plan, after the stall works |

Mock-ups come before stages 1 and 2 (Settings → Payments, the ticket and Charge screens).

## Questions for the owner (all answered)
1. ~~Stall ticket~~: answered (Q10, a new kind of order).
2. ~~Who may charge~~: answered (Q11).
3. ~~Stall refunds~~: answered (Q12).

## Stage 0 progress (2026-10-20)
- Test page (not in the app): `scratch/square-test/` (git-ignored), served over HTTPS on the home Wi-Fi with the dev certificate (a phone browser upgrades plain http to https).
- **iPhone, Safari:** our page opened Square Point of Sale with A$1.00, cash only, and Square returned to `https://order.shaggybobo.app/seller/sell/square-return?data={"error_code":"payment_canceled","status":"error","state":"stage0-…"}`. So the handoff and the return work, and **our reference (`state`) comes back unchanged**. The sale itself was cancelled.
- **Paused:** the Square app on the test phone is signed in to an account that isn't set up as a business, so it can't finish a sale. Next: run the test with a Square account that can already take sales (a kitchen's, or the owner's), finish a cash sale, and look the `transaction_id` up on the server. Still to test: Android, and the installed home-screen app.
