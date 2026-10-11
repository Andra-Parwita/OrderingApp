# 032 · Invite links, single-use keys, and pausing a kitchen

**Status:** draft (2026-10-10). Asked by the builder before plan 028: "when I create an invite key for the seller, I need to be able to also copy the link", and "does admin have the ability to disable a kitchen so the seller is no longer able to access it?" The handover doc lists "Create, pause or remove kitchens" for admins.
**Goal:** every invite can be sent as one link that opens the setup page with the key filled in; an invite key lets one device in ([D-085](../decisions/README.md)); and the admin can pause a kitchen in two ways ([D-086](../decisions/README.md)).

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Single-use keys.** An invite key admits one device within 24 hours, then it is spent (`KEY_MAX_DEVICES` 3 → 1). The texts that say "up to 3 devices" are updated (EN/ID). | `shared/authContract.ts`, `worker/db/auth.ts`, admin and seller-setup i18n | tests: a second device with the same key is refused with the plain error; the first still works |
| 2 | **Invite links.** Every invite box (admin → seller `src/features/admin/KeyBox.tsx`, owner → chef `src/features/seller-setup/ChefKeyBox.tsx`) gets two buttons: **Copy link with key** and **Copy key**. The link is `https://<host>/seller/setup?kitchen=<slug>#key=<key>`. The setup page reads `#key=` once, fills the field, and removes it from the address bar (`history.replaceState`), so it isn't kept in history or shared on. The key never goes in the query string. | `src/features/admin/`, `src/features/seller-setup/`, `src/app/AuthRoutes.tsx`, `src/features/seller-auth/SetupKeyScreen.tsx`, i18n | tests: both buttons copy the right text; opening the link fills the key and clears the `#`; a link without `#key` shows the empty field |
| 3 | **Pause on the server.** `sellers` gains `paused TEXT CHECK (paused IS NULL OR paused IN ('full', 'customers'))` (migration at the next free number). **Full:** every session of the kitchen is deleted, sign-in, keys and codes are refused, staff routes answer 403 `kitchen_paused`, customer menu and ordering answer `kitchen_closed`, and no push is sent for it. **Customers only:** staff work as normal; the customer menu and ordering answer `kitchen_closed`. In both, a customer's existing order page still opens. Admin routes: `POST /api/admin/sellers/:id/pause` `{ kind }` and `/resume`. Nothing is deleted except sessions. | `migrations/`, `worker/db/`, `worker/api/routes.ts`, `worker/api/authRoutes.ts`, push sending, `shared/` | tests: full pause signs everyone out and refuses sign-in, keys and codes; customers-only lets staff in; both refuse new orders but open existing ones; resume restores all; only an admin can pause |
| 4 | **Pause in the apps.** Admin kitchen row: a state label (Open / Closed to customers / Paused) and **Pause…** with the two choices explained, plus **Resume**; a confirm for the full pause, which signs people out. Customer menu: "This kitchen is closed for now" (EN/ID). Seller app in "customers only": a banner "Customers can't see your kitchen right now". A paused kitchen's sign-in page says "This kitchen is paused. Contact the admin." | `src/features/admin/`, `src/features/customer-menu/`, `src/app/SellerLayout.tsx`, `src/features/seller-auth/`, i18n | tests: each state shows its text; e2e the admin pauses and resumes the demo kitchen |

## End of phase

- [ ] typecheck · lint · format · `mocks` auth and pause tests · `shared` · admin, seller-setup, seller-auth, customer-menu unit tests · e2e `admin`, `seller-auth` (`--workers=1 --no-deps`)
- [ ] The builder sends themselves an invite link on the phone, and pauses and resumes the demo kitchen on the live app

## Decisions and notes

- D-085: invite keys work once, for 24 hours. D-086: two kinds of pause, the admin picks.
- Removing a kitchen for good is not in this plan (it needs a backup step first).
- Playwright note: the test projects depend on each other in a chain; run a narrowed set with `--no-deps`.
