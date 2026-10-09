# API routes

Every route the Worker answers, from [`worker/api/index.ts`](../../worker/api/index.ts), [`routes.ts`](../../worker/api/routes.ts) and [`authRoutes.ts`](../../worker/api/authRoutes.ts). Request and response types are in [`shared/`](../../shared/) (`*Contract.ts`), shared with the app. The path from browser to database is in [overview.md](overview.md).

**Auth column**

| value | meaning |
|---|---|
| public | no sign-in; customers and the sign-in screens |
| token | public, but the order's private token in the URL is the key (D-007) |
| setup | a session that has no device yet (between sign-in and registering a passkey or password) |
| signed in | any full session |
| seller | a seller session; a chef session too unless marked "seller only" (chefs may not change the menu, chefs, sets, images, week or settings, and may not use backup or invites, D-013) |
| admin | an admin session (admins never see order data) |
| dev | only when `DEV_TOOLS=1`; otherwise the route answers as if it did not exist |

State-changing calls (POST, PUT, PATCH, DELETE) to `/api/seller/*`, `/api/admin/*` and `/api/auth/*` also need a same-site `Origin` header (D-048). With `DEV_TOOLS=1` and no session, seller routes take the seller from the `X-Seller` slug header.

## Public

| method | path | auth | purpose |
|---|---|---|---|
| GET | `/api/health` | public | liveness, server time, whether dev tools are on |
| GET | `/images/<key>` | public | stream a seller image from R2 (content-hashed, cached a year) |
| GET | `/api/s/:slug/menu` | public | one seller's menu, week and ordering state |
| POST | `/api/s/:slug/orders` | public | place an order |
| GET | `/api/orders?tokens=a,b` | token | My orders: look up to 20 tokens across sellers (live, archived, expired) |
| GET | `/api/orders/:token` | token | one order (live, archived "week closed", or expired stub) |
| PATCH | `/api/orders/:token` | token | customer edit (items, fulfilment, note) |
| POST | `/api/orders/:token/cancel` | token | customer cancel |

## Sign-in

| method | path | auth | purpose |
|---|---|---|---|
| POST | `/api/auth/invite` | public | redeem an invite or recovery key, start a setup session |
| POST | `/api/auth/code` | public | redeem a 6-digit add-device code |
| POST | `/api/auth/password` | public | sign in with the password fallback |
| POST | `/api/auth/passkey/options` | public | WebAuthn options to sign in |
| POST | `/api/auth/passkey` | public | verify a passkey, start a full session |
| POST | `/api/auth/register/options` | setup | WebAuthn options to register a passkey |
| POST | `/api/auth/register` | setup | register the first device (passkey or password) |
| POST | `/api/auth/sign-out` | public | end the session, clear the cookie |
| POST | `/api/auth/device-codes` | signed in | make a 6-digit code to add another device |
| GET | `/api/auth/me` | signed in | who am I, which seller, which role |
| GET | `/api/auth/devices` | signed in | my devices |
| PATCH | `/api/auth/devices/:id` | signed in | rename one of my devices |
| DELETE | `/api/auth/devices/:id` | signed in | sign out and remove one of my devices |

Sign-in calls are rate limited per browser id (no IP is stored); five wrong tries lock a key for 15 minutes.

## Admin

| method | path | auth | purpose |
|---|---|---|---|
| POST | `/api/admin/setup` | public | create the first admin with the `ADMIN_SETUP_KEY` secret |
| GET | `/api/admin/sellers` | admin | list sellers |
| POST | `/api/admin/sellers` | admin | add a seller (name and slug); its first week is the coming Saturday |
| POST | `/api/admin/sellers/:id/invite-key` | admin | make a first-sign-in key for the seller |
| POST | `/api/admin/sellers/:id/recovery-key` | admin | make a recovery key |
| GET | `/api/admin/sellers/:id/chefs` | admin | chefs with their device counts |
| POST | `/api/admin/sellers/:id/chefs/:chefId/sign-out-all` | admin | sign a chef out everywhere |
| GET | `/api/admin/sellers/:id/devices` | admin | the seller's devices |
| DELETE | `/api/admin/sellers/:id/devices/:deviceId` | admin | remove a seller device |

## Seller and chef

All under `/api/seller/`. "Seller only" routes answer 403 to a chef.

| method | path | auth | purpose |
|---|---|---|---|
| GET | `live` | seller | WebSocket to the seller's Durable Object: "something changed" events, no customer data |
| GET | `menu` | seller | the menu with remaining portions, chefs and ordering state |
| GET | `settings` | seller | kitchen settings: greeting, closing, WhatsApp, ordering switch |
| PUT | `settings` | seller only | change the settings |
| GET | `week` | seller | this week's dates, cut-off, pickup point, delivery |
| PUT | `week` | seller only | change the week |
| POST | `week/publish`, `week/unpublish` | seller only | open or hide the menu |
| POST | `week/close` | seller only | archive the week's orders and start the next draft |
| GET | `past-weeks`, `past-weeks/:id` | seller | closed weeks: totals, and orders for 4 weeks |
| POST | `menu/items` | seller only | add an item |
| PATCH, DELETE | `menu/items/:id` | seller only | change or remove an item |
| PUT | `menu/order` | seller only | reorder items |
| GET | `chefs` | seller | list chefs |
| POST | `chefs` | seller only | add a chef |
| PATCH, DELETE | `chefs/:id` | seller only | rename or remove a chef (removing signs them out) |
| POST | `chef-invites` | seller only | make a sign-in key for a chef |
| GET | `chef-devices` | seller only | devices signed in per chef |
| GET | `sets` | seller | list saved menu sets |
| POST | `sets` | seller only | save the menu as a set |
| PATCH, DELETE | `sets/:id` | seller only | rename or delete a set |
| POST | `sets/:id/use` | seller only | replace the menu with a set |
| GET | `images` | seller | the kitchen's images |
| PUT | `images` | seller only | banner colour and alt text |
| PUT, DELETE | `images/:slot` | seller only | upload (to R2) or remove an image |
| GET, POST | `backup` | seller only | download or restore everything of this kitchen |
| GET | `orders.csv` | seller | this week's orders as CSV |
| GET | `orders` | seller | this week's orders, newest first |
| POST | `orders` | seller | enter an order for a customer |
| GET | `orders/:code` | seller | one order |
| POST | `orders/:code/status` | seller | move the order to its next status |
| POST | `orders/:code/paid` | seller | mark paid or unpaid |
| POST | `orders/:code/lock` | seller | lock or unlock customer changes |
| POST | `orders/:code/wa-received` | seller | mark the WhatsApp message as received |
| POST | `orders/:code/arriving-soon` | seller | "arriving soon" message (delivery only) |
| POST | `orders/:code/nudge`, `orders/:code/seen` | seller | nudge the customer; clear the "changed" flag |
| POST | `updates` | seller | bulk message (and optional status) to up to 200 order codes |

## Dev only

| method | path | auth | purpose |
|---|---|---|---|
| GET | `/api/dev/sellers` | dev | sellers for the dev seller picker |
| POST | `/api/dev/sample-orders` | dev | add sample orders to the picked seller |
| POST | `/api/dev/reset` | dev | delete every row and re-seed the two sample kitchens |

## Limits to keep in mind

- **50 D1 queries per Worker invocation** on the free plan. [`mocks/queries.test.ts`](../../mocks/queries.test.ts) puts 100 orders in a week and holds every seller and customer route under 40.
- Not an HTTP route: the weekly cron calls `scheduled` in [`worker/index.ts`](../../worker/index.ts) (see [overview.md](overview.md#weekly-retention-cron)).
