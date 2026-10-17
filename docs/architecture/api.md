# API routes

Refreshed 2026-10-13. Every route the Worker answers, from [`worker/api/index.ts`](../../worker/api/index.ts), [`routes.ts`](../../worker/api/routes.ts), [`authRoutes.ts`](../../worker/api/authRoutes.ts), [`logRoutes.ts`](../../worker/api/logRoutes.ts), [`translate.ts`](../../worker/api/translate.ts) and [`kitchenRoutes.ts`](../../worker/api/kitchenRoutes.ts). Request and response types are in [`shared/`](../../shared/) (`*Contract.ts`), shared with the app. The path from browser to database is in [overview.md](overview.md).

**Who column**

| value | meaning |
|---|---|
| public | no sign-in; customers and the sign-in screens |
| token | public, but the order's private token in the URL is the key (D-007) |
| setup | a session that has no device yet (between a key and registering a passkey or password) |
| signed in | any full session |
| owner | a kitchen session whose role is owner |
| chef | owner or chef; a chef is limited as in [Role limits](#role-limits) |
| helper | owner, chef or helper where marked; a helper only gets the short allowlist below |
| admin | an admin session (admins never see order data; a seller route answers 403 to them) |
| dev | only when `DEV_TOOLS=1`; otherwise the route answers as if it did not exist |

State-changing calls (POST, PUT, PATCH, DELETE) to `/api/seller/*`, `/api/admin/*` and `/api/auth/*` also need a same-site `Origin` header (403 `bad_origin`, D-048). With `DEV_TOOLS=1` and no session, seller routes take the kitchen from the `X-Seller` slug header and the audit name from `X-Actor`.

## Public and customer

| method | path | who | purpose |
|---|---|---|---|
| GET | `/api/health` | public | liveness, server time, version, whether dev tools are on |
| GET | `/api/status` | public | plan 046: `{ maintenance, notice: { from, until, noteEn, noteId } \| null, time, backupMinutes: { customer, seller } }` (plan 074: minutes between backup checks while a live connection is down, 1 to 30, default 5 each; clients use 5 when absent); cached 5 s; every screen reads it (every 5 min, every 30 s while the Updating screen is up) |
| POST | `/api/maintenance` | release token | plan 046: `{ maintenance: boolean }` with `Authorization: Bearer <MAINTENANCE_TOKEN>`; 401 without the secret or with a wrong token; no other route accepts the token |
| GET | `/images/<key>` | public | stream an image from R2 (content-hashed, cached a year) |
| GET | `/k/<slug>/manifest.webmanifest` | public | the kitchen's customer web-app manifest (`?start=` for an order page); also `seller.webmanifest`, `icon-<180\|192\|512>.png\|svg` and `apple-touch-icon.png` (always an image: the upload, or the shared default) |
| GET | `/api/s/:slug/menu` | public | the kitchen's menu, theme, languages and ordering state; each pickup point may carry `address`, `lat`, `lng` (plan 076); `mapsEmbedKey` whenever the server has `MAPS_EMBED_KEY` |
| POST | `/api/s/:slug/orders` | public | place an order (a delivery order may carry `address`: street, suburb, postcode, notes, lat/lng; ignored when the server has no `ADDRESS_KEY`; the menu answer says `addresses: true` when it has; an optional `customerCode`, 24 hex characters, the phone's anonymous per-kitchen code, stored on the order) |
| POST | `/api/s/:slug/orders/find` | public | find a lost order by code and first name (2 wrong tries lock that code 15 min; every miss answers alike, D-075) |
| GET | `/api/s/:slug/team-names` | public | names of people with a password, for the password sign-in picker (D-090) |
| GET | `/api/s/:slug/live?tokens=a,b` | token | plan 074: WebSocket (upgrade) for a customer's live updates; up to 20 tokens, each must be an unfinished order of this kitchen on its active menu (else 404 `not_found`; 400 for none or more than 20; 426 without upgrade). The room sends only `order.changed` for those orders (`{type, code?, at}`; no code = a bare nudge), never kitchen-wide events |
| GET | `/api/orders?tokens=a,b` | token | My orders: up to 20 tokens across kitchens (live, archived, expired) |
| GET | `/api/orders/:token` | token | one order (live, archived, or expired stub) |
| PATCH | `/api/orders/:token` | token | customer edit (items, fulfilment, note, `address` or `address: null`) |
| POST | `/api/orders/:token/cancel` | token | customer cancel |
| POST | `/api/orders/:token/collected` | token | "I've collected it" (idempotent) |
| POST, DELETE | `/api/orders/:token/push` | token | turn web push on or off for this order |
| GET | `/api/push/public-key` | public | the VAPID public key; 404 when push is not set up |
| POST | `/api/log` | public | a device sends a few scrubbed error entries (rate limited by a hashed address) |

## Sign-in

| method | path | who | purpose |
|---|---|---|---|
| POST | `/api/auth/invite` | public | redeem an invite or recovery key; starts a setup session (a person already signed in just joins the kitchen) |
| POST | `/api/auth/code` | public | redeem a 6-digit add-device code |
| POST | `/api/auth/password` | public | sign in with a name from the team list and a password |
| POST | `/api/auth/passkey/options` | public | WebAuthn options to sign in |
| POST | `/api/auth/passkey` | public | verify a passkey, start a full session |
| POST | `/api/auth/register/options` | setup | WebAuthn options to register a passkey |
| POST | `/api/auth/register` | setup | register the first device (passkey or password) |
| POST | `/api/auth/sign-out` | public | end the session, clear the cookie |
| POST | `/api/auth/switch` | signed in | change the active kitchen (403 `forbidden` if not a member) |
| POST | `/api/auth/device-codes` | signed in | make a 6-digit code to add another device |
| GET | `/api/auth/me` | signed in | who am I, which kitchen, which role (clears a cookie the server no longer knows) |
| GET | `/api/auth/memberships` | signed in | my kitchens and roles |
| GET | `/api/auth/devices` | signed in | my devices |
| PATCH, DELETE | `/api/auth/devices/:id` | signed in | rename, or sign out and remove, one of my devices |

Sign-in calls are rate limited per browser id (30 per minute; no IP is stored). Five wrong tries lock a key or person for 15 minutes (`locked_out` with `retryAfterSeconds`). A paused kitchen answers `kitchen_paused`.

## Admin

All under `/api/admin/`. The admin has no kitchen session and sees no order data.

| method | path | who | purpose |
|---|---|---|---|
| POST | `setup` | public | create the first admin with the `ADMIN_SETUP_KEY` secret (`admin_exists` once one exists) |
| GET, POST | `sellers` | admin | list kitchens; add one (name and slug; `slug_taken`). Each row's `summary` carries `people`, `devices` (plan 073: the device count for the row, so the admin home needs no `members` call per kitchen), `menu`, `orders` and `lastActiveAt`, all from four grouped queries, so the list is one request and a fixed number of D1 trips however many kitchens there are |
| GET, PATCH | `maintenance` | admin | plan 046: read, or change `maintenance` (on/off) and the announced `notice` (`null` clears it; `until` after `from`; notes max 200) |
| GET, PATCH | `backup-minutes` | admin | plan 074: read, or change `{ customer?, seller? }` (whole minutes 1 to 30; anything else or an empty body is 400); rides on `GET /api/status` |
| PATCH | `sellers/:id` | admin | switch demo mode on or off |
| POST | `sellers/:id/pause`, `sellers/:id/resume` | admin | pause (`customers` or `full`, a full pause signs everyone out) or resume (D-086) |
| POST | `sellers/:id/invite-key`, `sellers/:id/recovery-key` | admin | invite an owner by name (recovery is the same call, D-090) |
| GET | `sellers/:id/invites` | admin | open invites |
| GET | `sellers/:id/members`; DELETE `.../members/:accountId` | admin | the kitchen's people; remove one |
| GET | `sellers/:id/chefs`; POST `.../chefs/:chefId/sign-out-all` | admin | chefs with device counts; sign a chef out everywhere |
| GET, PUT, DELETE | `sellers/:id/images`, `.../images/:slot` | admin | set a kitchen's five pictures (same checks as the seller's upload) |
| GET | `sellers/:id/devices`; DELETE `.../devices/:deviceId` | admin | the kitchen's devices; remove one |
| GET, DELETE | `log` | admin | read a page (50) of the client error log; clear it |

## Seller, chef and helper

All under `/api/seller/`. See [Role limits](#role-limits) for who may call what: GET is open to owners and chefs unless marked; "owner" means a chef gets 403 `forbidden`.

| method | path | who | purpose |
|---|---|---|---|
| GET | `live` | any staff | WebSocket to the kitchen's Durable Object: "something changed" events, no customer data |
| POST | `translate` | chef | translate dish text EN/ID with Workers AI (see [Errors](#errors)) |
| GET | `menu` | helper | the menu with remaining portions, chefs, ordering state |
| PATCH | `menu/items/:id` | chef (own item), helper (sold-out switch alone) | change an item; the sold-out switch |
| POST | `menus` | owner | make a new menu (only after the last one finished: `menu_in_progress`) |
| GET, PUT | `menus/current` | helper (GET), owner (PUT) | read or change the current menu |
| POST | `menus/current/items` | owner; chef (own dish) | add a library dish to the menu (`already_on_menu`) |
| POST | `menus/current/publish`, `.../unpublish` | owner | go live; back to not published |
| DELETE | `menus/current` | owner | delete a not-published menu |
| PUT, DELETE | `menus/current/picture` | owner | upload (to R2) or remove the menu picture |
| POST | `menus/current/finish` | owner | finish now: archive orders, close open ones (`menu_not_live`) |
| GET | `menus/:id/chef-summary` | owner, chef | portions and income per chef for `current` or a menu id (plan 069): owner sees every chef, a chef only her own line and only while `chefs_see_income` is on (else 403 `forbidden`); the current (or just-finished) menu is computed live, an older menu is read from the `past_weeks.chef_summary` snapshot, and 404 when it has none ("not kept") |
| GET, POST | `dishes` | chef | the dish library; add a dish (a chef's dish is forced to her own) |
| POST | `dishes/import` | chef | dish CSV import (a chef: own dishes) |
| PATCH, DELETE | `dishes/:id` | chef (own) ; delete owner | edit a dish; delete (warns if on the live menu) |
| PUT, DELETE | `dishes/:id/picture` | chef (own) | plan 067: upload (`{dataUrl}`, square, at most 200 KB, to R2) or remove the dish's one picture; answers `{dish}`; `dish_picture_limit` (409) at 300 pictures; the file is deleted once no dish, menu item, menu or set uses it |
| GET, POST | `saved-sets` | owner | saved sets (lists of dishes) |
| PATCH, DELETE | `saved-sets/:id` | owner | rename or delete a set |
| POST | `saved-sets/:id/use` | owner | put the set on the menu |
| GET, POST | `pickup-places` | owner | saved places (max 5: `pickup_place_limit`); optional `address`, `lat`, `lng` (plan 076; a pin needs an address, bounds checked) |
| PATCH, DELETE | `pickup-places/:id` | owner | change or remove a place; `address` replaces address and pin together, `address: null` removes them |
| GET, PUT | `preferences` | helper (GET), owner (PUT) | colour theme and new-menu defaults (incl. `chefsSeeIncome`) |
| PUT | `kitchen/name` | owner | rename the kitchen |
| GET, PUT | `settings` | chef (GET), owner (PUT) | WhatsApp number, greetings, languages |
| GET, POST | `chefs` | chef (GET), owner (POST) | the cook list; add a cook |
| PATCH, DELETE | `chefs/:id` | owner | rename or remove (removing signs them out) |
| POST | `invites` | owner | invite a person by name and role (owner, chef or helper); returns the 24 h key |
| POST | `chef-invites` | owner | older chef-only form of the invite |
| GET | `chef-devices` | owner | devices signed in per chef |
| GET, DELETE | `team`, `team/:accountId` | owner | the kitchen's people; remove one (ends their sessions here) |
| GET, PUT | `images`, PUT/DELETE `images/:slot` | chef (GET), owner | the kitchen's pictures: upload to R2, colour and alt text |
| GET, POST | `backup` | owner | download or restore everything of this kitchen (`invalid_backup`) |
| GET | `past-weeks`, `past-weeks/:id` | chef | finished menus: totals, and orders for 4 weeks |
| GET | `orders.csv` | chef | the live orders as CSV |
| GET | `orders` | helper | live orders, newest first |
| POST | `orders` | chef | enter an order for a customer |
| GET | `orders/:code` | chef | one order. Every seller order answer carries the decrypted `address` (`{address}` or `{unavailable: true}`) for the kitchen's own team only (plan 071, D-099); seller answers also carry `customerCode` (never any customer answer) |
| POST | `orders/:code/status` | helper | move to the next status |
| POST | `orders/:code/collected` | helper | confirm the hand-over |
| POST | `orders/:code/address-seen` | helper | "Got it" on the customer's changed address (plan 071); customer order answers then say `addressChange: 'seen'` |
| POST | `orders/:code/delete-address` | chef | "Delete address now" (plan 071; not a helper) |
| POST | `orders/:code/pack`, `delivery-step`, `paid`, `lock`, `wa-received`, `nudge`, `seen` | chef | packing ticks, delivery step, paid, lock, WhatsApp received, nudge, clear "changed" |
| POST | `updates` | chef | bulk message (and optional status) to up to 200 order codes |
| GET | `messages` | helper | the current menu's message log |
| POST | `messages/place/:placeId` | chef | message everyone waiting at a place |
| GET | `day/log` | helper | the day-sales log |
| POST | `day/sale`, `day/undo`, `day/count` | helper | sell on the day, undo a sale, set a stock count. Chef gets 403 on all of `day` |
| GET, POST | `made` | chef | shared "made" counts; add to a count |
| POST, DELETE | `demo/samples` | chef | add or clear sample orders (demo kitchens only: else 403) |

## Role limits

| role | what the Worker allows |
|---|---|
| owner | everything for the active kitchen |
| chef | everything except: backup, invites, team, chef-invites, chef-devices, `day`, and every non-GET on `menu`, `chefs`, `sets`, `images`, `week`, `settings`, `menus`, `saved-sets`, `pickup-places`, `preferences`, `kitchen` (`chefMayNot`). Exception (plan 030, D-094): a chef adds, edits, imports and puts on the menu **her own** dishes, and edits her own menu items, judged on the stored row, never the body |
| helper | deny by default (`helperMay`): list and read orders; move an order's status or mark collected; GET `menu`, `menus/current`, `messages`, `preferences`; the day-sales calls; PATCH of a menu item with the sold-out switch alone. Everything else is 403 `forbidden` ("Helpers cannot do this") |
| admin | no `/api/seller/*` (403); only `/api/admin/*` and own sign-in |

A helper's actions in an order's history carry the role `chef` with the helper's own name (D-092).

## Errors

Every 4xx is `{ error, message }`, with the codes in [`shared/apiError.ts`](../../shared/apiError.ts). Some carry extras: `triesLeft`, `retryAfterSeconds` (`locked_out`), `warning` (an overridable refusal; send `force: true` to go ahead, D-062). Added recently:

| code | when |
|---|---|
| `fulfilment_unavailable` | a customer order asks for pickup or delivery that the menu does not offer |
| `already_on_menu` | the dish is already on the current menu (D-094) |
| `maintenance` | plan 046: maintenance is on; every POST, PATCH, PUT and DELETE answers **503** with `X-Maintenance: 1` (the app never retries it and shows the Updating screen). Reads, `/api/admin/*`, `/api/auth/*`, `/api/log` and `/api/maintenance` are exempt |
| `translate_limit` | the kitchen used its 100 translations today (counted in its Durable Object; text max 500 characters) |
| `translate_unavailable` | no `AI` binding (for example local) or the model failed; never retried |
| `forbidden` | a valid session whose role may not do this (helper allowlist, chef limits, admin on a seller route, income kept private) |
| `kitchen_paused`, `kitchen_closed` | the kitchen is paused (no sign-in), or closed to customers (no new orders or changes) |
| `menu_in_progress`, `menu_not_live`, `pickup_place_limit`, `not_preorderable`, `password_exists`, `passkey_exists` | menu and sign-in rules from plans 001, 025 and 029 |

## Dev only

| method | path | who | purpose |
|---|---|---|---|
| GET | `/api/dev/sellers` | dev | kitchens for the dev picker |
| POST | `/api/dev/sample-orders` | dev | add sample orders to the picked kitchen |
| POST | `/api/dev/reset` | dev | delete every row and re-seed the sample kitchens |

## Not HTTP routes

- The **crons** call `scheduled` in [`worker/index.ts`](../../worker/index.ts): hourly (finish due menus, sweep find-order tries) and Mondays 03:00 UTC (retention). See [overview.md](overview.md#scheduled-jobs).
- The **page** requests that are not `/api`, `/k` or `/images` go to the static assets, with the head rewritten for kitchen, order and seller pages ([overview.md](overview.md#request-path)). The public seller Help page is at the hidden path in [`shared/help.ts`](../../shared/help.ts) and answers with `X-Robots-Tag: noindex`.

## Limits to keep in mind

- **50 D1 queries per Worker invocation** on the free plan. [`mocks/queries.test.ts`](../../mocks/queries.test.ts) puts 100 orders in a week and holds every seller and customer route under 40.
