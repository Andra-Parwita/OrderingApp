# 105 · The seller edits an order (items, quantities, note, name), also a customer's

**Status:** analysis, owner 18 Oct, not approved. Mock-up: [105-seller-edit-order.html](../../uxDesign/seller/mockups/105-seller-edit-order.html). No app source changed.
**Owner, 18 Oct:** "seller add order but they can not edit, but have to cancel and change. I think we need to allow seller to change order, and even if it's from customer (which then we can identify or send notification to customer if needed that order changed)."

## Findings (verified in the code)
- **Today the seller can add an order** (`POST orders`, `worker/api/sellerOrderRoutes.ts:172-186` -> `createSellerOrder`, `worker/db/sellerOrders.ts:139`; owner and chef), **switch pickup <-> delivery** (`PATCH orders/:code/fulfilment`, `sellerOrderRoutes.ts:222-243` -> `changeFulfilment`, `sellerOrders.ts:226`, with a `notify` flag), set status, paid (`:306`), lock (`:323`), cancel. There is **no route that changes items, quantities, note or name** of an existing order.
- **The customer can change** items, note, fulfilment and address (`PATCH /api/orders/:token`, `worker/api/orderTokenRoutes.ts:56-72` -> `updateOrder`, `sellerOrders.ts:82-104`). Refused when ordering is closed or past the cut-off (`closedError`, `sellerContext.ts:238`), when `locked` (`:88`) or when the status is final (`:89`). Sets `changed = true`, writes an audit entry `edited` with a diff (`editDraft`, `sellerContext.ts:547`), and the seller sees the "Changed" chip and the line "<name> changed this order" (`OrderPanelBody.tsx:236`; i18n `panel.changedBy`). Cleared by the next status move (`sellerOrders.ts:193`) or "Seen".
- **Reusable pieces** in `worker/db/sellerContext.ts`: `buildLines` (`:293`, three modes: `refuse` for customers, `warn` = `over_limit` warning for staff, `allow` for `force`, D-062; keeps the snapshot of lines already on the order, D-020; `used` must leave out the order being edited, which `loadState(order.id)` does), `patched` (`:526`), `portionGuard` + `commit` (`:376`, `:413`; the guard rolls the batch back on a race), `addAudit`/`addInbox`, `changeByCode` (`:556`, commits and pushes inbox entries), `diffOrder` (`shared/auditDiff.ts`: items delta, note, fulfilment). The audit already takes a staff actor (`changeFulfilment` writes `what: 'edited', by: actor`).
- **The seller UI to reuse:** New order is `NewOrderPanel.tsx` (slide-over, 319 lines, tablet) and `NewOrderScreen.tsx` (phone, 483 lines), both on `useOrderDraft.ts` (name, language, qtys, note, how, confirmNow, paid) and the shared `Stepper`, `TextField`, `SlideOverEditor` from `src/ui`. They only create; neither opens prefilled. The pickup/delivery switch is `src/components/change-fulfilment/ChangeFulfilment.tsx` (opened from `OrderPanelBody.tsx:306`). `OrderPanelBody.tsx` (471 lines) has no edit button.
- **Telling the customer today:** `addInbox` entries become pushes in `worker/push/dispatch.ts` (`:107` special-cases the fulfilment message: title "Order changed", else the kitchen name; body from `shared/pushText.ts`, key `FULFILMENT_CHANGED_KEY` at `:115`). The customer page lists inbox messages newest first (`orderParts.tsx:279-305`). Push is sent only to orders with a stored subscription; the seller cannot see whether one exists.
- **Locks and cut-off:** D-024 (`docs/decisions/README.md:134`) already rules that "the seller and chefs can still ... enter or edit orders" after the cut-off, so editing there is covered. D-062: warn, never block. `locked` only stops the customer.
- **Private orders** (plan 081) are edited by the owner only through `PATCH private/:code` (`worker/api/privateRoutes.ts:76-90`, `updatePrivate`, `worker/db/private.ts:441`) and have no customer push. This plan is for menu orders and leaves private orders alone (the new route refuses them, like the customer routes do).
- **Money:** there is no stored total or paid amount on an order; the total is the sum of lines. So an edit on a paid order changes what is owed without any column knowing it.
- **Audit** keeps the last 4 entries (D-013, trigger in `worker/db/orders.ts:98`); the diff is JSON (`diff_json`), so new optional diff fields need no migration.

## Rules proposed (recommendation in bold)
| Rule | Proposal |
|---|---|
| Who | Owner and chef (same as add order, fulfilment, paid; the owner kept chef rights as today, plan 104 C1-C5). **A helper may not.** On a private order only the owner, as now (by the existing private PATCH). |
| What can change | Dishes and quantities (add, remove, change), the note, the first name (typo fix; code and link stay the same). Pickup <-> delivery stays on its own route, shown as a row in the same sheet. Not the customer's language. An order must keep at least one dish (to remove everything, Cancel). |
| Statuses | **Any status, never refused (owner ruling): Ordered, Confirmed, Ready, Out for delivery, Collected, Delivered and, as an open point, Cancelled.** Warnings are information only ("already delivered", "already packed/ready", paid, over the portion limit). |
| Cut-off, closed ordering, lock | **Seller may always (D-024); the customer stays locked out.** No new rule. |
| Portion limits | **Warn, not block (D-062):** the sheet shows "Only 2 left", Save asks once more, then sends `force`. Sold-out and "sold on the day only" dishes follow the same warn rule as New order. |
| Paid orders whose total changes | **Keep Paid; show the gap** ("Paid $22.00, total now $26.00, $4.00 to collect") on the panel and in the toast. Needs the old total in the audit diff (JSON). |
| Seller order vs customer order | Same sheet. The "Changed" flag (customer edited, seller must look) is **cleared by a seller edit** (the seller has just seen it). Audit says "Edited by Chandra". |

### Open questions (one at a time, owner)
- **E1 Statuses: answered, no status limit.** Edit order works in every status and shows a warning, never a refusal. **E1b (open): Cancelled orders.** A (recommended): editable, with a "Cancelled" warning, like the rest. B: read-only until the order is re-opened.
- **E2 Paid order, total changes.** **A (recommended): keep Paid and show the amount still to collect (or to refund).** B: automatically mark Not paid. C: ask each time in the sheet.
- **E3 Telling the customer (see below).** A: always. **B (recommended): a "Tell the customer" tick, on for a customer's order, off for a seller-typed one.** C: never.
- **E4 Name.** **A (recommended): name can be edited.** B: items, quantities and note only.
- **E5 Helper.** **A (recommended): no, as for add order.** B: helper may edit orders they can already move along.

## Telling the customer
- **Push** (only if the customer turned it on; only for non-private orders): title "Order changed" / "Pesanan diubah", body "Your order 59X-MAP was changed by Onde Onde" / "Pesanan 59X-MAP Anda diubah oleh Onde Onde". Reuses the fulfilment-changed path in `dispatch.ts`, with a second text key `orderEdited`.
- **Order page:** an inbox `message` entry in the order's language (`text` built on the server with `formatAuditDiff`, like `fulfilmentChangedText`): "Changed by the kitchen · Sat 5:12 pm" with "+1 Pastel · -1 Lalampa · +1 Es cendol" and the new total. Shown as a band under the status and in Updates. Without the tick, the items and total still update on the page (the live signal/poll), but no message and no push.
- **WhatsApp:** after saving, the toast has "Copy message" (a short text with the order number, what changed and the new total, in the customer's language, built from the same diff). Useful when the customer has no push.
- **Options:** A always notify (simple, but a typo fix pings the customer); **B tick, default by order origin (recommended)**; C never (customer finds out by looking).

## Server (no migration expected; confirmed)
- **New route:** `PATCH orders/:code` (roles `OWNER_CHEF`, `{ addresses: true }` as its neighbours) in `sellerOrderRoutes.ts`. Body `EditSellerOrderRequest = { lines?, note?, firstName?, notify, force? }` with `parseEditSellerOrderRequest` in `shared/orderContract.ts` (same personal-data guard as the other parsers; no phone). Refuses private orders (`privateRefusal`). Answers like the other order routes (`changed(...)`, so the live signal and `order.changed` fire).
- **Store:** `editOrder(code, input, actor)` in `worker/db/sellerOrders.ts` beside `changeFulfilment`: `readLiveOrder` -> `loadState(order.id)` -> `patched`-like step with `over = force ? 'allow' : 'warn'` -> audit `{ by: actor, what: 'edited', diff }` -> `changed: false` -> optional inbox entry -> `commit`. `commit` skips the portion guard when `force` (as `place` does). A portion race still returns the `lostRace` answer.
- **Audit diff:** add optional `name: true` and `total: { from, to }` (cents) to `AuditDiff` (`shared/domain.ts:39`) and to `diffOrder`/`formatAuditDiff` (+ words in both languages). It lives in `diff_json`, so no column. The panel finds "paid, total changed" from the newest `edited` entry that is newer than the newest `paid` entry (the audit keeps only 4; if the paid entry has scrolled out, the gap line is simply not shown. Acceptable; if the owner wants it exact, the one column to add is `orders.paid_cents INTEGER`, a migration, **not recommended**).
- **First name** is `orders.first_name` (migration 0001); the update is a plain column write in `changeStatements`.
- **Push:** `pushText.ts` gets `ORDER_EDITED_KEY` and its title/body in EN and ID (the drift test `pushText.test.ts` covers inbox text parity, so the inbox keys are added to `customer-orders/i18n` too); `dispatch.ts` title branch.
- **Roles:** the route allow-list test (plan 098) gets the new row; helper refused. The sheet and panel mark the origin: "Ordered by the customer" / "Dipesan oleh pelanggan" vs "Added by the kitchen" / "Ditambah oleh dapur" (from `enteredBy`).

## Stages
| # | stage | size |
|---|---|---|
| 0 | Owner approves the mock-up and answers E1-E5 | - |
| 1 | Shared + worker: request type and parser, `AuditDiff` additions, `editOrder`, route, push/inbox text, live signal | M |
| 2 | Seller sheet: extract the dish/name/note fields from `NewOrderPanel` and `NewOrderScreen` into one shared form part (keep files under about 750 lines; do not grow the big ones), `EditOrderSheet` (slide-over on tablet, full sheet on phone), "Edit order" button in `OrderPanelBody`, saga/slice `editOrderRequested`, each line with − n + and a 44 px remove button (struck with Undo until Save), an "Add dish" list of the live menu with remaining portions, Save disabled with a hint at 0 dishes, a "Removed: … · Added: …" summary (also in the audit text), over-limit confirm, after-state ("Edited by", diff, paid gap), "Edited" chip | L |
| 3 | Customer: "Changed by the kitchen" band and Updates line, EN/ID strings | S |
| 4 | "Copy message" toast (WhatsApp text from the diff) | S |
| 5 | Docs: `docs/architecture/api.md` (route), `data-model.md` (diff fields), `sequences.md`/`product/flows.md` (order change flow), a new decision (D-100: seller may edit any open order; tell-the-customer tick); `pnpm run docs`; release checklist | S |

## Tests
- **Unit:** `shared/contracts.test.ts` (parser: empty lines, personal data, force/notify types); `shared/auditDiff.test.ts` (name, total); `worker` store test for `editOrder` (every status incl. Delivered and Cancelled accepted (no refusal); locked and past cut-off ok; over limit -> `over_limit` warning, `force` passes; portion race; private refused; `changed` cleared; audit by actor; notify adds inbox, silent does not); route role matrix (helper refused, chef ok); `dispatch` push title/body in EN and ID; `pushText.test.ts` parity.
- **Mocks / component:** add a dish from the list (new line, snapshot price, portions left shown), remove a line and Undo, last dish removed disables Save with the hint; `EditOrderSheet` prefilled from an order, − / + and total "was", tick default by origin, over-limit confirm, save disabled when nothing changed or no dishes; panel after-state and paid gap; customer band (`screens.test.tsx` style). Saga test for the request/result.
- **E2E (new `e2e/p105-seller-edit-order.spec.ts`):** (1) customer places an order, seller changes a count, removes a dish and adds another with the tick on, customer's order page shows the band and the new total; (2) locked order after cut-off is editable by the seller while the customer is refused; (3) paid order shows the gap; (4) a helper has no Edit button. Phone width for (1).

## Deploy impact
- Adds one API route and a new optional field inside `diff_json`; no migration, no secret, no new dependency. Old clients ignore the new inbox key (unknown `textKey` falls back to the message `text`); an old customer app shows the inbox `text` as is. A Worker deployed before the app is harmless (the route is unused); the app deployed before the Worker would get 404 on Save, so deploy both in one release.
- Behavioural risk: a seller edit on a Ready or Delivered order (warned only); a paid order whose total grew (shown, not auto-unpaid). Live check after deploy: edit a customer order on the tablet with the tick on, watch the customer page and a push on a real phone; edit a seller-typed order; edit a locked order.

## Owner rulings (18 Oct)
- **Edit order covers all dish changes** (owner: "edit order should also allow remove dishes, add dishes and also change count"): change a count (− / +), remove a dish (count to 0 or a remove button), and add any dish from the current menu (an "Add dish" list in the sheet). At least one dish must stay.
- **The seller may change anything, in any status; never blocked, only told** (owner, 18 Oct: "seller will be able to do what they want, so simply show warning or indication if this is created by customer"). The sheet shows a clear "Ordered by the customer" mark on a customer's order, and warnings (e.g. already delivered, paid, over the portion limit) as information, not refusals. Answers E1 (statuses: no limit).
- **In release 1.0.42** (owner, 18 Oct: "for 42 include 103, 105"). Open: E1b, E2–E5.
- **E1b (owner, 18 Oct): a cancelled order is editable; Save asks** "Keep it cancelled" or "Re-activate the order" (owner: "when they edit we can ask question or when save: save as cancel or reactivate order"). Re-activate puts it back to Ordered and it counts again in cooking, totals, labels and print.
- **E2 = A (owner, 18 Oct):** a paid order stays Paid and shows "Paid $18.00 · total now $24.00 · $6.00 to collect" (or "to refund"); the seller can later update it or mark it Not paid (the Paid confirm sheet, fix 7 of plan 103).
- **E3 = B (owner, 18 Oct):** a "Tell the customer" tick in the sheet, on for customer-placed orders, off for seller-added ones; when on: push (if enabled) + "Changed by the kitchen" line on the order page; after Save a "Copy message" for WhatsApp.
- **E4 = A (owner, 18 Oct):** the name is editable; the history shows "Name: Lenni → Lenny".
- **E5 = A (owner, 18 Oct: "make it simple as per existing behaviour"):** editing follows adding: owner and chef may edit, a helper may not (no Edit order button). All plan 105 questions answered.
