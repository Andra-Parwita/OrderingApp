# 033 · People and memberships: one kitchen passkey, a kitchen switcher, invite links

**Status:** approved by the builder (2026-10-10: "A", build all 5 stages; screenshots of new screens are approved before deploy). From the owner's handover doc ("One passkey per person; kitchens are memberships with a role") and the builder's rulings D-087 (admin stays separate), D-088 (today's seller and chef logins are demo and may be cleared), D-089 (this comes next). Absorbs stages 1–2 of plan 032 (single-use keys D-085, invite links).
**Goal:** a kitchen person (owner or chef; helpers follow in 028) has one login with their own passkeys and an optional password. They belong to one or more kitchens with a role in each and switch between them in the seller app. Invites are links that add a membership. The admin login is untouched.

## The model

| | today | after 033 |
|---|---|---|
| login | one per kitchen (`seller:<id>`) or per chef (`chef:<kitchen>:<chef>`) | one per **person** (`person:<id>`), with a **display name** (D-090) |
| what you can do where | the login's role | **memberships**: (person, kitchen, role `owner`/`chef`, linked cook) |
| who cooks a dish | the kitchen's `chefs` list | unchanged: the `chefs` list; a chef membership links its cook row, and an owner can tick "I also cook" (the handover's "owners can be assigned items") |
| active kitchen | fixed by the login | kept on the session; switching checks the membership |
| admin | `admin` account, own passkey | **unchanged** (D-087) |
| passwords | per kitchen login | per person, same PBKDF2 hashing and lockouts (builder: keep as fallback) |

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Schema.** One migration (next free number): new `people`-style accounts (`accounts` rebuilt with role `admin` or `person`, a `display_name`), `memberships(account_id, seller_id, role, chef_id, created_at)`, invite keys carry `seller_id`, `role`, `chef_id`, `display_name` instead of an account. **Clears every non-admin account, device, session, key and code** (D-088); the admin account and its devices are copied across untouched. Kitchens, menus, dishes, chefs, images and orders are not touched. | `migrations/`, `worker/db/auth.ts` | tests: after migrating a copy of a seeded DB, the admin still signs in; no staff login is left; kitchens and orders are unchanged |
| 2 | **Server sign-in.** Sessions hold `account_id` + active `seller_id`. Every staff route resolves the caller's role from the membership for that kitchen, per request (`chefMayNot` and the owner checks read the membership). New: `GET /api/auth/memberships`, `POST /api/auth/switch` `{ sellerId }`. Passkey sign-in finds the person; password sign-in is `{ slug, accountId, password }` (the person picked from that kitchen's team). Removing a membership ends that kitchen's sessions at once. | `worker/db/auth.ts`, `worker/api/authRoutes.ts`, `worker/api/routes.ts`, `shared/authContract.ts` | tests: one person in two kitchens switches and each kitchen sees only its own data; a removed member is refused on the next request; a chef membership is closed out of owner routes; admin routes unchanged |
| 3 | **Invites.** An owner invites by **name + role** (admin invites first owners the same way); the key admits **one device within 24 hours** (D-085). The invite box has **Copy link with key** and **Copy key**; the link is `/seller/setup?kitchen=<slug>#key=<key>`, read once and cleared from the address bar. Redeeming: a signed-in person (or one who signs in with their passkey or password on the join screen) gets the membership added ("Sign in to join"); a new person sees "Welcome, <name>" prefilled and creates a passkey, or a password. | `worker/db/auth.ts`, `src/features/seller-auth/`, `src/features/admin/KeyBox.tsx`, `src/features/seller-setup/` (Chefs → Team), i18n | tests: a new person joins and lands in the kitchen; an existing person joins a second kitchen without a new passkey; a key works once; the link fills the key and clears the `#` |
| 4 | **Kitchen switcher.** Top of the seller rail (tablet and desktop) and the More tab (phone): "Onde Onde · Owner ▾", listing each membership with its role; hidden with one kitchen. The last kitchen is remembered per device. Reuses or replaces `SellerPicker`. | `src/app/SellerRail.tsx`, `src/app/session.tsx`, `src/components/SellerPicker.tsx`, `src/features/seller-orders/` (More tab), i18n | tests: two memberships show the switcher, one hides it; switching reloads the kitchen's data; e2e a person switches between demo and onde-onde |
| 5 | **Team and devices screens.** Settings → Team lists members (name, role, devices, "also cooks"), invite, change role, remove (with "reassign their dishes" prompt for a chef with dishes, from the handover's "Reassign on leave"). Devices shows the person's own devices across kitchens. Admin kitchen page lists members instead of logins. | `src/features/seller-setup/`, `src/features/seller-auth/DevicesScreen.tsx`, `src/features/admin/`, i18n | tests: change role, remove with reassign, device list; admin sees members |

Mock-ups of the switcher, the join screen ("Welcome, <name>" and "Sign in to join"), the password sign-in with the team list, and the Team screen come **before** stages 3–5 are built.

## End of phase

- [ ] typecheck · lint · format · all `mocks` auth, multi-seller and route tests · `shared` · seller-auth, seller-setup, admin, app unit tests · e2e `seller-auth`, `admin`, `multi-seller`, `session-flow` (`--workers=1 --no-deps`)
- [ ] Deploy (with plan 027): the migration clears demo logins on the live database; the builder joins demo and onde-onde with one passkey and keeps the admin passkey separate

## Decisions and notes

- D-085 single-use keys, D-087 admin separate, D-088 clear logins, D-089 order, D-090 display name.
- Not here: helpers (028, a third membership role), pause (032 stages 3–4), one customer app across kitchens (open question in the handover doc).
- Highest-risk stage: 2 (every staff route's permission check moves to memberships). It gets its own route-by-route tests before any UI work.
- Server built (2026-10-10): migration `0007_people.sql`; mocks+shared 661/661. Owners show as role `seller` in `Me` so existing checks keep working. Deviations: "sign out all" for a cook ends that kitchen's sessions only; `team-names` lists only people with a password; a person left with no kitchen is deleted with their devices. Single-use key race (two devices at once) being fixed. Plan 026 must take the next free migration number (0008+).
- UI B built (2026-10-10): kitchen switcher (rail + phone More), Team screen with invite link/key, Cooks list kept. No reassign API: after removing a chef with dishes the screen links to the menu. Follow-ups: rename the Settings pane "Chefs" → "Team"; e2e for the switcher.
- UI A built (2026-10-10): invite link fills the key; "Join <kitchen>" when signed in; "Already have a login? Sign in to join" (passkey); password sign-in picks a name ("Who are you?"); admin invite box with name, Copy link with key, Copy key; admin kitchen page lists People. Deviation: the name is not editable before joining (no key-preview endpoint), and "Join" shows the kitchen slug, not its name.
