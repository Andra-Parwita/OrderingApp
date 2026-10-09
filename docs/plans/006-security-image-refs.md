# 006 · Security fix: image refs stay with their seller

**Status:** approved by the builder (2026-10-10: "Fix the security issues raised and follow through with the recommended outcomes"); **done** (06:30). The coordinator re-ran the 4 test files (66/66) and eslint on worker, shared and src/components (clean).
**Goal:** one seller can never delete, point at or show another seller's stored images. This closes the security review finding (10 Oct, `/security-review`; MEDIUM, confidence 8, confirmed by a separate verification pass).

## The finding
- `POST /api/seller/backup` stored image refs as arbitrary strings (`parseImages`, the menu `pictureRef`, saved-set images).
- Deleting or replacing that slot then removed the R2 object behind the ref with no owner check: `dropUnusedImages`, then `deleteImageRefs`, where `keyOfRef` accepts any `sellers/<id>/…`.
- Seller A could therefore delete seller B's images by copying their public paths into a restored backup.
- A side effect: arbitrary strings reached CSS `url("…")` unescaped (`SellerLayout.tsx:57`, `SignInFrame.tsx:60`).

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Delete only your own keys.** `deleteImageRefs` (and `dropUnusedImages`) take the acting `sellerId` and delete only keys under `sellers/${sellerId}/`; anything else is skipped. | `worker/images/r2.ts`, `worker/api/routes.ts` | a test: a foreign ref in the seller's own row is not deleted from R2 on delete or replace |
| 2 | **Only own refs get in.** One helper, e.g. `isOwnImageRef(ref, sellerId)`: empty, or `keyOfRef(ref)` resolves to `sellers/<sellerId>/…`. It is applied to the backup restore (kitchen images, the menu picture, saved-set images) and to any other path that stores a ref given by the client. Foreign or malformed refs are dropped, the slot is left empty, and the reply says how many were dropped; the restore is not refused. | `worker/db/seller.ts` (restore), `worker/api/routes.ts`, `shared/` parsers if a seller id is available there, otherwise in the worker | tests: a restore with another seller's ref or an external URL stores nothing for that slot; own refs survive a backup round trip |
| 3 | **Safe CSS urls.** Where an image ref goes into CSS `url()`, it is checked and quoted safely: only own-app paths (`/images/…`, `/samples/…`) or `data:image/…`, with `"`, `\` and newlines escaped or rejected. | `src/app/SellerLayout.tsx`, `src/app/SignInFrame.tsx`, a small shared helper | a unit test: a ref containing `")` cannot break out of `url()` |

## End of phase
- [ ] typecheck · lint · format:check · the touched unit and server tests (`mocks/r2.test.ts`, the backup/setup tests)
- [ ] The full gate runs with plan 004's end-of-phase gate (plan 004 is mid-phase).

## Notes
- **Below the review's reporting threshold (about 6/10), not in this plan:**
  - the 6-digit add-device code lockout is keyed on the client-supplied `deviceId` (rotating it avoids the per-device limit);
  - `redeemCode` has a read-then-update race on `used`.
  Both are worth a small follow-up before going live (owner to decide).
- **Result:**
  - `deleteImageRefs` and `dropUnusedImages` take the seller id and delete only `sellers/<own id>/` keys (7 callers);
  - `isOwnImageRef` filters the restore (kitchen slots, `bannerImageUrl`, saved-set images, menu picture), and the reply now carries `droppedImages`;
  - `cssUrl()` allows only safe `/images/` and `/samples/` paths or `data:image/(png|jpeg|webp)`.
  Each fix has a test that fails without it.
- **Decisions:** `/samples/…` and `data:image/(png|jpeg|webp);base64` count as own (static or dev-only, never deleted from R2). `ImagesScreen.tsx` keeps its own escaping `cssUrl`, which is already safe.
