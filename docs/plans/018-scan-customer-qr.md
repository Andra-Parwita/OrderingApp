# 018 · Seller: scan the customer's QR to find and hand over the order

**Status:** proposed (2026-10-10, builder: "do we have capability in seller app to scan customer QR code and then highlight or popup the customer order, and then we can mark it as picked up or collected easily? … we should have it"; not needed for the demo). The dependency is approved (D-078, 11:20). Starts after plan 015, which edits the same Orders files.
**Today:** the customer's order page shows a QR of the order code (`src/components/OrderQr.tsx`). The seller has no camera scanning: the hand-over search takes typed codes, because camera scanning was deferred until a dependency was approved (batch 4 trade-off in docs/decisions).
**Goal:** at pickup, the seller taps **Scan**, points the iPad or phone at the customer's QR, and that order opens at once with a big **Mark collected** (or **Delivered**) button.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Decoder.** Use the browser's built-in `BarcodeDetector` where it exists (Chrome on Android). iPad and iPhone Safari don't have it, so fall back to **`jsqr`** (small, no dependencies, MIT licensed), loaded only when scanning starts. **Needs the owner's OK** (CLAUDE.md: no new dependency without it). | `package.json`, `src/components/scan/` | a test: a QR image of a code decodes to that code |
| 2 | **Scan sheet.** A **Scan** button (camera icon) in the Orders header, and on the Pickup and delivery screen. It opens a full-screen camera view with a frame, a torch toggle where supported, and Cancel; the back camera is preferred. Camera permission is asked only on tap. A plain message shows if the permission is refused, with the typed-code search as the fallback. EN/ID. | `src/components/scan/`, `src/features/seller-orders/`, `src/features/seller-saturday/` | tests with a fake decoder: the found code opens that order; a refused camera falls back |
| 3 | **Found order.** The order opens in the detail panel (tablet) or as the order page (phone), with the row highlighted. Its **primary button is the next hand-over step**: Mark collected for pickup, Delivered for delivery, plus Paid if unpaid. A code from another kitchen, a cancelled order or an unknown code shows a clear message instead. A short vibration on found where supported. | the same files | tests: found, wrong kitchen, cancelled, unknown |

## End of phase
- [ ] typecheck · lint · format · unit tests · one e2e with a fake camera stream on `mobile-chromium` · a real check on the iPad and an Android phone by the builder
