# 027 · Admin access: two people, device codes on the admin side, device names

**Status:** done (2026-10-10), not deployed yet. Approved by the builder the same day. From the live app: the builder lost track of the admin setup key, added an admin device through `/seller/setup` (the only page that takes a 6-digit code) and it was named "Computer" with no way to rename it. The owner's handover doc asks for "two admins, so the platform isn't locked out if one loses a passkey".
**Goal:** both admins (the owner and the builder) each have their own named devices, add a new one from the admin pages, and the runbook says what to do if every admin device is lost.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Code entry on the admin side.** `/admin/sign-in` gets "Use a 6-digit code" (the existing `DeviceCodeScreen`, redeem route unchanged). After the code: a device-name field prefilled with the guess, then "Add a new passkey" (admins have no password); it lands on `/admin`. A seller or chef code entered here is refused with a clear message, and an admin code entered on `/seller/setup` goes on to `/admin` instead of `/seller`. | `src/app/AuthRoutes.tsx`, `src/features/admin/` (sign-in, i18n), `src/features/seller-auth/SetupKeyScreen.tsx` (reuse only) | tests: an admin code on `/admin/sign-in` ends on `/admin` with the typed name; a seller code there is refused; e2e `admin` with a virtual authenticator |
| 2 | **Rename the admin's devices.** "Your devices" on the admin home gets Rename, the same as the seller Devices screen, through the existing rename route. | `src/features/admin/AdminHomeScreen.tsx`, i18n | tests: rename shows the new name; only the admin's own devices |
| 3 | **iPad named iPad.** `guessDevice` treats a "Macintosh" user agent with a touch screen (`navigator.maxTouchPoints > 1`) as an iPad. Sellers benefit too. | `src/features/seller-auth/authText.ts` | tests: iPadOS desktop-mode UA plus touch gives `ipad`; a real Mac gives `computer` |
| 4 | **Recovery written down.** The deploy runbook gets "All admin devices lost": the owner removes the admin's devices with one `wrangler d1 execute --remote` statement, sets a new `ADMIN_SETUP_KEY` secret, and sets up again at `/admin/setup`. The coordinator checks the statement against a local D1 first. | `docs/guide/deploy-cloudflare.md` | the statement, run on a local copy, leaves no admin devices and `/admin/setup` accepts a new key |

## End of phase

- [x] typecheck · lint · format · admin and seller-auth unit tests · `mocks/auth*.test.ts` · e2e `admin` and `seller-auth` (`--workers=1`)
- [ ] The builder adds a named admin device on the iPad from `/admin/sign-in`

## Decisions and notes

- **Two admins = one admin account, each person with their own named devices** ([D-080](../decisions/README.md), builder chose A "for now"). Both people have the same rights, so separate admin accounts add nothing yet; plan 031 logs admin changes by device name. Either admin can add a device for the other. If the owner later wants separate admin accounts (for example to see who did what), that is a new plan.
- Admins opening a kitchen's menu and orders is [plan 031](031-admin-views-kitchen.md).
- Gate (2026-10-10): typecheck, lint, format; unit 249/249 (admin, seller-auth, app, mocks/auth); e2e `admin` and `seller-auth` green on both auth projects. The admin code → passkey → `/admin` flow has unit tests but no e2e (needs a second browser with its own virtual authenticator).
- Fixed on the way: `e2e/seller-auth.spec.ts` assumed a fresh account; since plan 025 the second project sees the passkey and password the first one made ("Add a new passkey", "Use your password").
- Open finding (not from this plan): `e2e/banners.spec.ts:44` "never cropped" failed once on desktop-chromium in a full run; not re-checked yet.
