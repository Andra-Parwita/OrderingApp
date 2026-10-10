# 017 · Settings: the customer link, copy, share and QR

**Status:** approved by the builder (2026-10-10: "in settings .. we should also have a label or section or copy-able text of the customer URL .. or even QR code, so it's easy to send the URL to the customer via WA or any other means").
**Goal:** the seller always finds the kitchen's customer link in one place, and can copy it, share it (WhatsApp or the phone's share sheet) or show and save a QR code for printing or a stall sign.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **"Customer link" pane in Settings** (first in the list, EN/ID). It shows the full link (`origin/slug`, e.g. `https://order.shaggybobo.app/demo`) as selectable text, plus: **Copy link** (clipboard, with a "Link copied" toast; fallback: the text is selected), **Share** (`navigator.share` where it exists, else a WhatsApp link with the kitchen name and the link, using the existing `whatsAppUrl` helper), and a **QR code** of the link (reuse the lean-qr setup in `src/components/OrderQr.tsx`; dark on white, large enough to scan from a printed page), with **Download QR** (a PNG named `<slug>-qr.png`) and **Print**. The link is built the same way as `ShareScreen` builds it (one helper, not a second copy). | `src/features/seller-settings/` (a new pane, `panes.ts`, the i18n), a small shared link helper only if `ShareScreen` has none to reuse | tests: the pane shows the right link; Copy calls the clipboard with it; the QR encodes it; Share falls back to WhatsApp |
| 2 | **Seller app link** (builder, 11:20: "seller app setting should also have link to the seller URL so easy to scan the URL or QR code and open it in a different device"). In the same pane (renamed **Links**, EN/ID), a second block: **Seller app**: `origin/seller/sign-in?kitchen=<slug>`, with Copy, Share and a QR (no download or print needed). A one-line note: "Open this on another device, then sign in (or use a 6-digit code from Devices)." It contains no secret; sign-in is still required. | `src/features/seller-settings/CustomerLinkPane.tsx`, the i18n | tests: the seller link is right; Copy copies it; the QR is labelled with it |

## End of phase
- [ ] typecheck · lint · format:check · `src/features/seller-settings` and `src/features/seller-share` unit tests
