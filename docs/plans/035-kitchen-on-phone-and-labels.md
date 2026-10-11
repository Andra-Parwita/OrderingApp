# 035 · Kitchen and Pack on the phone, shared progress, labels that never cut items

**Status:** approved by the builder (2026-10-10: "A, A": approve; made counts shared live). Stages 1–3 building; stage 4 after the 033 server work. Builder: "in seller on phone also have the ability to see the kitchen ... chef and owner who cook can also use the phone easily to keep track ... and mark it, so I know how much is done ... do we have a packaging screen? ... mark it as packed and print an order label per bag, or print A4 of all labels"; "some may have many orders so be careful".
**Goal:** a cook or owner can run Kitchen (Cook and Pack) and Labels from a phone; progress is the same on every device; one bag's label prints from Pack; a long order's label continues on a second label instead of losing items.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Labels never cut items** (builder "A", D-091). An order that doesn't fit one 99 × 38 mm label (or a 62 × 40 mm roll label) continues on the next, each part with code, name, QR and "1 of 2". The split is by item lines (a fixed lines-per-label count per paper, measured), never mid-line; the note goes on the last part. The preview says "16 labels for 14 orders". | `src/features/seller-labels/` (labelModel, LabelsScreen, i18n) | tests: an order with 12 lines makes 2 labels with every line once; short orders stay one label; the count line is right; a capture of an A4 page with a long order |
| 2 | **Phone layouts.** Kitchen (Cook and Pack, including the who-ordered panel from 034) and Labels open on the phone (remove them from the phone's "open on a tablet" list), reached from More; one-column phone layouts with large tap targets. | `src/app/sellerNav.ts`, `src/app/AppRoutes.tsx`, `src/features/seller-cook/`, `src/features/seller-labels/`, `src/features/seller-orders/` (More tab entries) | tests: the routes render on a phone width; captures at 375 px |
| 3 | **Print one bag's label from Pack.** "Print label" on each bag prints that order's label(s) only (A4 position 1 or the roll, by the device's last choice). | `src/features/seller-cook/PackTab.tsx`, `src/features/seller-labels/` (a shared print component) | tests: the button prints one order |
| 4 | **Shared progress** (builder "A": shared live). "Made" counts (today on the device only, `madeCounts.ts`) and "packed" are stored on the server per kitchen and cooking day and update live on every device through `SellerLive`. | `migrations/`, `worker/`, `shared/`, `src/api/`, `src/features/seller-cook/` | tests: a count on one device shows on another; two taps at once both count |

Stage 4 waits for the plan 033 server work (same files). Stages 1–3 can be built now.

## End of phase

- [ ] typecheck · lint · format · seller-cook, seller-labels, app unit tests · e2e the labels and cook specs (`--workers=1 --no-deps`) · captures at 375 px and 1024 px

## Decisions and notes

- D-091: long orders continue on the next label.
- Stages 1–3 built (2026-10-10): unit 156/156 (labels, cook, app). Labels hold 4 item lines (3 on the last part when there is a note), calculated from the print CSS, not yet measured on paper; a very long dish name ends in "…" on its line instead of wrapping. Shared label code moved to `src/components/labels/`.
- Stage 4 built (2026-10-10): `0008_made_counts.sql`, `GET/POST /api/seller/made` (adds in SQL, so concurrent taps both count; live via `order.changed`); "packed" and line ticks were already on the server. Stale counts are cleared when the menu changes, not by the weekly clean-up. mocks+shared+seller-cook 711/711.
