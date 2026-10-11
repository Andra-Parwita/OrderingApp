# 041 · The admin sets a kitchen's images

**Status:** approved (2026-10-11, owner: "A"). Owner: "in admin when I create a seller … I can update or initialise those images, so the seller can have a good default, or I can ask to design an image for their kitchen".
**Goal:** from the admin page, the admin uploads (or replaces, or removes) a kitchen's five images for the seller: wide banner, phone banner, left-menu logo, app icon, banner background. It's the same slots, size lines, checks and guides as the seller's Settings → Images (plan 040), and the seller can still change them later. No database change; images live in R2 as today (a replaced image's old file is deleted once nothing uses it).

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Admin image routes.** `PUT /api/admin/sellers/:id/images/:slot` (the same body and checks as the seller's upload: type, ratio ±5%, 600 KB) and `DELETE` for the same slot, admin session only, reusing `putUploadedImage` and the clean-up of unused images, scoped to that seller's R2 prefix. | `worker/api/authRoutes.ts` (admin routes), `worker/images/r2.ts` (reuse only), `shared/authContract.ts` (if a response type is needed), `src/api/` (client calls), `mocks/` tests | tests: the admin uploads a banner for a seller and the seller's menu shows it; a seller or anonymous caller gets 401/403; a wrong size is refused like the seller's; replacing deletes the old object |
| 2 | **Images in the seller's row.** In the expanded seller row (plan 038), an "Images" part with the five slots, each showing its preview, its size line and "How to make this picture" (plan 040). The upload UI is shared with Settings → Images, not copied: the app layer hands the admin page the same images component configured with the admin calls (features may not import each other). The admin page's privacy line becomes "This page manages access and the kitchen's pictures. It shows no orders or customers." | `src/features/admin/`, `src/features/seller-setup/ImagesScreen.tsx` (made reusable with injected upload/remove calls), `src/app/AuthRoutes.tsx` (the slot), i18n | tests: the admin sees the five slots for a seller and uploading one shows its preview; the seller's own Settings still works unchanged |

## End of phase
- [ ] typecheck while building
- [ ] lint · format:check · unit tests for `src/features/admin`, `src/features/seller-setup`, `mocks` · e2e `admin`, `seller-setup`
- [ ] capture: the admin page with a seller expanded and its Images part, 1361 × 865 and 390 × 844

## Decisions and notes
- The starter set (option C, generic ShaggyBobo images for every new kitchen) was not chosen. Missing images keep today's fallbacks: the default app icon, and the kitchen's colour and name.
