# ShaggyBobo — Square Payments Integration Proposal

**Status:** Investigation and implementation brief for Claude Code  
**Date:** 20 October 2026  
**Scope:** Online customer orders and in-person event POS, using **one Square account per seller**.

## 1. Decisions and constraints

- ShaggyBobo is a multi-seller React + TypeScript + Redux/Redux-Saga PWA, hosted on Cloudflare, with URLs such as `shaggybobo.app/{sellerPath}`.
- Each seller connects **their own Square account once**, and the connection is shared across online checkout and event POS.
- Square is **optional, disabled by default**. Existing guest ordering, WhatsApp and manual/cash payment flows must continue working.
- The seller receives their own payment proceeds and pays their own Square transaction fees. ShaggyBobo does not charge platform fees.
- Minimise personal information. Never store payment card details. Do not create Square Customer records unless a future requirement explicitly needs them.
- Event sales are simple: staff take an order, customer pays, food is handed over immediately. Support order-number and QR lookup and cash payments.
- One designated Square Reader/payment device; other staff devices may create and prepare orders. Reserve stock for at most 10 minutes while payment is pending; do not create a customer queue feature.

## 2. Square integration choices

| Scenario | Preferred initial approach | Reason | Caveats |
|---|---|---|---|
| Online customer checkout | Square Checkout API / Square-hosted payment link | Simple hosted checkout; sensitive payment data stays with Square | Verify Apple Pay/Google Pay availability and redirect behavior for Australian sellers; reconcile via webhook and server-side fetch |
| In-person event with existing Square Reader | Square Point of Sale API mobile-web handoff | Opens Square POS app on a supported iOS/Android payment device to use its paired Reader | Requires installed/configured Square POS app; verify exact supported OS, browser/PWA and return behavior on target hardware |
| Future fully integrated reader UI | Mobile Payments SDK | Native iOS/Android Reader integration | **Not a browser SDK**; requires a native app or bridge, not suitable for pure React PWA MVP |
| Future Square Terminal hardware | Terminal API + Devices API | Web/cloud backend can initiate checkout on paired Square Terminal | Square Terminal is distinct from Square Reader; do not implement this for Reader-only setup |

**Important:** Do not attempt to connect a Square Reader directly to browser JavaScript or use Terminal API with Square Reader. POS API handoff is the MVP path for Reader hardware. Confirm Australian production eligibility and POS API behavior with a real Reader/device before committing.

## 3. Proposed architecture

```text
Customer PWA --------> ShaggyBobo Cloudflare API --------> Square Checkout API
                            |                                  |
Staff Event POS PWA --------+----> Square POS mobile handoff --> Square Reader
                            |
                            +----> D1: orders, stock, payment attempts,
                            |          seller Square connection metadata
Square Webhooks ------------+----> verified event processing / reconciliation
```

- Store encrypted Square OAuth credentials on the server, never in browser storage. Design a key-rotation mechanism and least-privilege access. If Cloudflare D1 is used, implement application-layer encryption for seller access/refresh tokens using server-held secrets.
- Record merchant ID, selected Square location ID, connection status, token expiry, and permitted scopes per seller. A seller can use the same merchant connection across both channels; allow different Square locations later without requiring them now.
- Never accept seller IDs, amount, currency, item price, or paid status from the browser as authoritative. Resolve the seller from the trusted route/session and calculate AUD cents on the backend.
- Isolate tenant access by seller ID on every read/write, including webhooks and device/session records.

## 4. Seller connection UX

1. Seller opens Settings > Payments > Connect Square.
2. Explain optional payment feature, seller's own fees, and supported channels.
3. Start Square OAuth with CSRF-protected `state`, exact redirect URI, minimal required scopes and server-side token exchange.
4. Retrieve seller merchant/locations; select default location, validate AUD and Australian account applicability.
5. Store encrypted tokens and enable channels **separately**: online payments and event POS.
6. Show Connected / Needs reauthorisation / Disconnected states; allow disconnect, revoke, and reconnect without losing historical payment references.
7. For Event POS, configure the designated cashier device and test the POS handoff and callback.

## 5. Online payment flow

1. Customer creates an order under the seller's URL.
2. Server validates menu availability, quantities, cutoff and stock; reserves inventory with a short expiration (10 minutes initially; configurable if online checkout needs more time).
3. Server creates a pending payment attempt and a Square-hosted checkout/payment link, using a unique idempotency key and order reference. Persist Square identifiers before exposing checkout URL.
4. Customer completes checkout on Square. Return/redirect is **not** proof of payment.
5. Square webhook arrives; verify signature against raw request body and subscription signature key. Fetch/verify the Square payment/order server-side, matching merchant, location, amount, currency, reference and payment state.
6. Atomically mark payment paid and commit reserved stock **once**; release on verified failure/cancellation/expiry. Show customer a recoverable pending state if webhook is delayed.
7. Handle retries and browser abandonment. Do not create a second charge when a customer refreshes or retries an uncertain attempt.

Check exact Checkout API request/response fields and wallet support against the pinned Square API version during implementation.

## 6. In-person Event POS flow — Reader

1. Staff add items on any authorised device; calculate total centrally and create event order with a 10-minute reservation.
2. Cashier retrieves by order number or scans QR, or receives the order from another staff device.
3. Cashier selects **Pay with Square** on the designated iOS/Android device with Square POS installed and Reader connected.
4. Launch Square POS via its **mobile-web Point of Sale API handoff** with amount, currency, transaction reference and callback configuration appropriate for the platform.
5. Cashier accepts payment on Square POS/Reader and returns to ShaggyBobo where supported.
6. Server confirms the Square payment independently; a client callback alone is insufficient to mark paid. Correlate Square transaction/payment ID and original order, reconcile via Payments API/webhook or polling as appropriate for POS API.
7. Show **Paid — Hand over food**; staff confirm handover. If payment succeeds but return/callback fails, provide a cashier reconciliation action before allowing another attempt.
8. Cash: staff select cash and explicitly confirm receipt; record a local cash payment (not a Terminal API payment), commit stock and allow handover.

**Reader limitations:** Square POS API supports mobile-web handoff, but the exact PWA installed-mode behavior and callback restrictions must be tested on both iOS and Android. Only one payment should be active on the designated device. Never assume Reader is compatible with Terminal API.

## 7. State model and stock consistency

Suggested order states: `DRAFT`, `AWAITING_PAYMENT`, `PAID`, `PAYMENT_FAILED`, `CANCELLED`, `FULFILLED`.

Payment attempts: `CREATED`, `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `UNKNOWN_RECONCILE`.

- Model order state and payment state separately. An order may be paid but not handed over.
- Enforce one successful payment per order; unique keys for Square payment IDs, event IDs and idempotency keys.
- Use a D1 transaction/atomic conditional update to commit stock once. Reserve inventory once, release it once; do not decrement twice on payment confirmation.
- Expired reservations must not cause a successfully paid order to disappear. If a late success occurs after stock release, flag an operational exception for seller resolution rather than silently overselling.
- Provide recovery for duplicated webhooks, webhook delays, lost callbacks, network loss, duplicate taps, Square declines, POS app cancellation, and disconnected Reader.
- Refunds and cancellations: use Square Refunds API when applicable and implement stock-restoration rules separately. Do not assume cancelling a ShaggyBobo order automatically refunds Square.

## 8. Suggested backend modules and data

Modules: `SquareOAuthService`, `SquareCheckoutService`, `SquarePosHandoffService`, `SquarePaymentReconciliationService`, `SquareWebhookHandler`, `PaymentProvider` interface, `InventoryReservationService`.

Tables (adapt existing schema, do not blindly create duplicates):

- `seller_payment_connections`: seller_id, provider, merchant_id, location_id, encrypted tokens, token expiry, status, online_enabled, pos_enabled, updated_at.
- `payment_attempts`: id, seller_id, order_id, channel, provider, amount_cents, currency, square_payment_id, square_order_id, square_checkout_id, idempotency_key, state, timestamps.
- `payment_events`: provider_event_id unique, event_type, processed_at, processing_result.
- `inventory_reservations`: order_id, item_id, quantity, expires_at, state.
- `event_pos_devices`: seller_id, device label, authorised staff/device ID, is_designated_cashier.

Use existing application interfaces and security patterns; do not couple domain order management to Square SDK types.

## 9. Security and privacy checklist

- Secure OAuth state, PKCE where applicable, token exchange and refresh; encrypted storage and secret rotation.
- Webhook signature validation on raw bytes; deduplicate events and handle out-of-order delivery.
- Seller role checks for payment configuration, cash confirmation, refunds and reconciliation.
- Rate limits, CSRF protections where relevant, Turnstile for abuse-prone anonymous operations, and audit trail for manual status changes.
- No PAN/CVV/card storage, no Square Customer creation by default; minimise names, addresses and payment metadata.
- Redact tokens and personal information from logs and error monitoring.
- Verify PCI scope and Australian privacy obligations based on actual data flows before production.

## 10. Implementation phases for Claude Code

**Phase 0 — Repository investigation (no code changes):** Identify current checkout, event POS, stock, order status, auth, D1 and Cloudflare architecture. Verify Square's current AU-supported APIs, OAuth scopes, checkout wallet support, Reader/POS API mobile-web requirements, and pricing. Produce gaps and a small proof-of-concept plan.

**Phase 1 — Shared payment foundation:** Provider abstraction, schema migrations, secure Square OAuth, seller settings, webhook verification, payment attempts, reconciliation and tests.

**Phase 2 — Online checkout:** Hosted checkout, pending/paid UX, inventory reservations, cancellation/expiry, idempotency and sandbox tests.

**Phase 3 — Event POS:** Cashier selection, order/QR lookup, Square POS handoff on real iOS/Android with Square Reader, cash, reconciliation, handover and timeout handling.

**Phase 4 — Production hardening:** AU real-device test, webhook retries, disconnected Reader, double-tap prevention, audit logs, refunds and multi-seller isolation tests.

## 11. Acceptance criteria

- Seller A's Square connection cannot be used by Seller B.
- Same Seller A Square account works for online and event channels.
- Disabling Square does not break guest, WhatsApp, manual or cash workflows.
- Customer redirect or POS callback cannot independently mark an order paid.
- Stock is committed exactly once per successful sale, including webhook retries.
- Payment outcome can be reconciled after browser close, Reader interruption or callback failure.
- No card details or unnecessary customer identities are stored.
- All event cashier operations work on the designated tested device with Square POS and Reader.
- Seller can disconnect Square without corrupting existing orders or history.

## 12. Verified official references and evidence

The links below are primary-source Square developer documentation, checked on 20 October 2026. They support the stated capabilities; implementation recommendations (such as keeping ShaggyBobo's own stock ledger) are design decisions, not Square requirements.

| Proposal claim | Official reference | What it establishes |
|---|---|---|
| Each seller can authorize ShaggyBobo to access their Square account | [Square OAuth API overview](https://developer.squareup.com/docs/oauth-api/overview) | Seller authorization, scoped tokens, refresh, revocation, and confidential-server versus PKCE flows. |
| Seller tokens must be stored securely | [Receive and manage OAuth tokens](https://developer.squareup.com/docs/oauth-api/receive-and-manage-tokens) | Encryption and secure token management guidance. |
| Hosted online checkout is available | [Square online payment options](https://developer.squareup.com/docs/online-payment-options) | Square-hosted Checkout API compared with embedded Web Payments SDK. |
| A checkout page can be created programmatically | [Create payment link API](https://developer.squareup.com/reference/square/checkout/create-payment-link) | Payment link creation, permissions, idempotency key, order and checkout options. |
| A mobile web app can hand off a payment to Square POS | [Build on Mobile Web](https://developer.squareup.com/docs/pos-api/build-mobile-web) | POS app launch, platform-specific links, callback configuration, and testing steps. |
| POS handoff needs platform-specific handling | [Mobile Web Technical Reference](https://developer.squareup.com/docs/pos-api/web-technical-reference) | Android and iOS request/callback parameters and technical details. |
| Payment callbacks should be verified rather than trusted as proof of payment | [Square Webhooks overview](https://developer.squareup.com/docs/webhooks/overview) and [Webhook signature validation](https://developer.squareup.com/docs/webhooks/step3validate) | Webhook delivery and signature validation guidance. |
| Square Terminal is a distinct future hardware path | [Terminal API overview](https://developer.squareup.com/docs/terminal-api/overview) | Terminal integration; does **not** mean an existing Square Reader supports Terminal API. |

### Evidence boundaries and required verification

- **One account for both channels:** OAuth grants access to a seller's Square account, while Checkout API and POS API provide separate payment channels. The combined ShaggyBobo workflow is our proposed architecture, not a single Square API feature.
- **Existing Square Reader:** Verify the precise Reader model, cashier phone/tablet OS, Square POS app version, Australian availability, and POS API support on real hardware before committing to the handoff flow.
- **Apple Pay / Google Pay:** Confirm payment-method availability for the Australian seller account, device, browser and checkout configuration; do not promise every wallet on every channel.
- **Order and inventory sync:** ShaggyBobo must implement its own transaction reconciliation, deduplication and stock rules. A POS callback or browser redirect alone must not mark a sale paid.
- **Fees:** Confirm current Australian Square processing rates separately from the developer integration documentation before publishing prices; no fixed fee estimate is asserted here.
- **Testing:** Sandbox can verify many online and OAuth cases, but physical Reader handoff requires production-compatible real-device testing using Square's prescribed approach.

**Instruction to implementing agent:** This document is a brief, not permission to rewrite the existing architecture. First inspect the repository and produce a detailed impact analysis, API compatibility check, minimal migrations, and implementation plan for approval. Prefer the simplest solution with no ShaggyBobo subscription or platform fees. Square's own processing fees and any hardware costs remain the seller's responsibility.
