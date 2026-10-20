# Data model (D1)

Refreshed 2026-10-13 from migrations [0001](../../migrations/0001_init.sql) to [0017](../../migrations/0017_past_menu_chef_summary.sql) and `worker/repo/Repository.ts`. The migrations are the truth; when a plan adds one, this page changes in the same change. The code that reads and writes the tables sits behind `worker/repo/Repository.ts` (see [Repository](#repository)).

## Conventions

| topic | rule |
|---|---|
| Engine | Cloudflare D1 (SQLite). Every table is `STRICT`. Foreign keys are on. |
| Money | integer **cents**, column suffix `_cents`, never negative. No floats anywhere. |
| Timestamps | **ISO-8601 text**, never epoch numbers. Instants the server makes are UTC with milliseconds (`2026-10-09T05:52:39.123Z`), so they sort and compare as text. The exception is `menus.cutoff_at`: the seller types it with an offset (`2026-10-09T21:00:00+11:00`) and it is kept as given; compare it in code (`Date.parse`), never as text. Dates are `YYYY-MM-DD` text. |
| Booleans | `INTEGER` 0 or 1 with a `CHECK`. |
| Bilingual text | two columns, `<name>_en` and `<name>_id`. |
| Ids | text. Seller-owned ids are only unique **within a seller**, so those tables use a composite key `(seller_id, id)`. Order `token` is globally unique. |
| Enums | `TEXT` with a `CHECK ... IN (...)`; the values are the TypeScript unions in `shared/`. |
| Order of lists | an explicit `position` column, never "insertion order". |
| Changing a CHECK | SQLite cannot, so the table is rebuilt: copy aside, drop children first, create, copy back (0007, 0010). |

## Per seller (D-036)

Every table below, except `sellers`, the sign-in tables marked "global" and `client_log`, carries `seller_id`, and **every repository query filters by it**. A seller handle in the repository is made from one seller row and cannot read another seller's rows. The only cross-seller reads are the ones D-036 allows: the order lookup by private `token` (customer links, My orders) and the admin's seller list.

## Tables

### Sellers and kitchen

| table | purpose | key | retention |
|---|---|---|---|
| `sellers` | one row per kitchen: `slug` (unique, lowercase, the customer link), `name`, `demo` (0006, D-076), `paused` (0012, D-086: NULL open, `customers` or `full`) | PK `id` | kept |
| `kitchens` | the public identity: `name`, `tagline_en/id`, `banner_image_url`, `banner_background` (`#rrggbb`), `image_alt_en/id`, and (plan 077, migration 0025) `time_zone` (IANA name, default `Australia/Adelaide`; the kitchen's wall clock for pickup windows and the cooking day, used by the hourly auto-finish and a new menu's default cut-off; set from the admin's device when the admin creates the kitchen) | PK `seller_id` | kept |
| `kitchen_settings` | the seller's own public `whatsapp_number` (D-027), `post_greeting/closing_en/id`, `theme` (5 themes, D-064), new-menu defaults (`default_cutoff_days/time`, `default_delivery`, `default_delivery_note_en/id`), `languages` (`both`/`en`/`id`, 0013), `first_language` (NULL = the customer's phone language, 0014), `chefs_see_income` (default 1, 0016) | PK `seller_id` | kept |
| `kitchen_images` | one row per filled slot (`railImage`, `railIcon`, `desktopBanner`, `phoneBanner`, `bannerBackgroundImage`): `ref` (an R2 path, or a `/samples/` path), `updated_at` | PK `(seller_id, slot)` | replaced on upload |
| `chefs` | the cook list (D-012): `name`, `position` | PK `(seller_id, id)` | until removed |

### The menu and the library

One menu per kitchen at a time (D-063). `0003` replaced the old `weeks` and `pickup_points`.

| table | purpose | key | retention |
|---|---|---|---|
| `menus` | the one menu: `state` (`not_published` > `live` > `finished`), `cooking_date`, `cutoff_at`, delivery switch and note, `picture_ref` (one 3:2 picture, D-060), `wizard_step`, `taking_orders`, `published_at`, `finished_at` | PK `seller_id` | replaced when the next menu is made |
| `pickup_places` | the seller's saved places (max 5, checked by the repository, D-061): `place`, `directions_en/id`, `window_start/end`, `position`, and (plan 076, migration 0024) an optional public `address` (≤ 200 chars) with an optional map pin `lat` / `lng` (both or neither, only with an address; not encrypted: the seller's own place, unlike D-099) | PK `(seller_id, id)` | until removed |
| `menu_pickup_places` | the places this menu uses, with an optional time for this menu only | PK `(seller_id, place_id)`; cascade from the place | with the menu |
| `dishes` | "Your dishes" library: names, descriptions, size, `price_cents`, `portion_limit`, `chef_id` (NULL = whole kitchen), `preorder`, `day_stock` (0011), `last_used_at`, and (plan 067, migration 0026) `picture_ref` (one optional square picture: an R2 path `/images/sellers/<id>/dishPicture-<hash>.jpg`, or a data URL without a bucket; at most 300 per kitchen) . Plan 111 (0031, D-112): `group_id` makes a row a **choice** of the parent dish (name EN/ID + `portion_limit` only; price, size, description, picture, chef, pre-order and day stock are copied from the parent and kept in sync); choices are never listed as top-level dishes and go with their parent | PK `(seller_id, id)` | until removed |
| `menu_items` | a menu dish: a **copy** with its own price, limit, chef, `sold_out`, `preorder`, `day_stock`; `dish_id` says where it came from and has no foreign key (D-062); it also copies `picture_ref` (0026), which is what customers read, and a dish picture change updates the copies . Plan 111: `group_id` = the parent menu item for a choice, positioned right after it; a choice has its own limit and `sold_out`; the parent with choices cannot be ordered and is sold out when all choices are | PK `(seller_id, id)` | with the menu |
| `saved_sets` | a named list of dishes (max 5): `name`, `position`, `times_used`, banner colour and alt text | PK `(seller_id, id)` | until removed |
| `saved_set_dishes` | the library dishes in a set | PK `(seller_id, set_id, position)`; cascade from set and dish | with the set |
| `saved_set_images` | a set's own copy of image refs, one row per slot | PK `(seller_id, set_id, slot)` | with the set |
| `message_log` | what the seller sent per group (`place:<id>`, `delivery`, `order:<code>`): type, minutes, optional text, `sent_count`. No customer data | PK `(seller_id, id)` | only the current menu's rows; a write for a new menu deletes the others |
| `made_counts` | how many of each dish are cooked (Cook screen, shared by all devices), written as increments | PK `(seller_id, menu_id, item_id)` | same: the old menu's rows go on the next write |
| `day_sales` | selling on the day (D-083): `kind` (`sale`, `count`, `undo`), `change`, `stock_after`, `by_account`, `by_name` (kept as text because accounts can go), `undone`, `undoes` (an undo reverses one sale, once) | PK `id`; UNIQUE `undoes` | **10 weeks** per kitchen, cut by the weekly cron (`dropOldDaySales`) |

### Orders

Live orders have `past_week_id` NULL (a private order also has `kind = 'private'` and keeps NULL for good; it is removed after the retention weeks, from its event date). Finishing the menu sets it (the finished menu's id), so the order leaves the live list but stays readable by its token (D-044). Nothing is copied.

| table | purpose | key | retention |
|---|---|---|---|
| `orders` | one order: `code` (6 chars), `token` (private link), `first_name`, `language`, `fulfilment`, `note`, `status`, `paid`, `locked`, `wa_received`, `is_returning`, `changed`, `entered_by_role/name`, `packed` (kept apart from status, D-066), `collected_at/by`, `pickup_place_id` (no FK; NULL = the menu's first place), `sample` (demo kitchens), `address_enc` (0018, plan 071: the delivery address, **encrypted**, see below; NULL = none), `address_changed` / `address_seen` (0020 / 0021, plan 071: flags only, the old address is never kept; a customer's real address change sets changed=1, seen=0; a team member's "Got it" sets seen=1; exposed as `addressChanged: 'new'; `client_order_id` (0033, plan 114): the customer app's one-time id for a Place order, so a repeat within 24 h returns the same order (unique per kitchen when set) | 'seen'` to the team and `addressChange: 'waiting' | 'seen'` to the customer), `customer_code` (0019, plan 071: the customer phone's anonymous random code for this kitchen; returned in seller order reads only; NULL = none, old apps send none), `past_week_id`, `kind` (0027, plan 081: `menu` or `private`; a **private (Khusus) order** is a one-off order the owner makes for an event: it never gets a `past_week_id` and never touches stock, cut-off, pause or auto-finish; every live-menu query goes through one `LIVE_MENU` fragment), `event_date` (kitchen-local YYYY-MM-DD) / `event_time` (HH:MM kitchen wall clock, D-101) / `deposit_cents` (private only; index `orders_by_event`); a private order's address is wiped one day after `event_date` | PK `(seller_id, id)`; UNIQUE `(seller_id, code)`; UNIQUE `token` | live until the menu finishes, then **4 weeks after the cooking date**, then deleted (a stub stays in `expired_orders`) |
| `order_lines` | the item snapshot (D-020): `item_id` (no FK), names, size, `price_cents`, `qty`, `ticked` (packing tick), `chef_id` (0027: a private order's line keeps the chef of the library dish; no FK) ; `note` (0031, plan 111): the customer's or seller's note for this line (≤ NOTE_MAX) | PK `(seller_id, order_id, position)`; cascade | with the order |
| `order_audit` | last 4 changes (D-013): who, what, `diff_json` (items, note, fulfilment; plan 105 adds `name` and `total` `{from,to}` for a seller edit) | PK `(seller_id, order_id, seq)`; cascade | **4 per order**, by trigger `order_audit_cap` |
| `order_inbox` | customer-visible messages (keys and data only) | PK `(seller_id, order_id, seq)`; cascade | **20 per order**, by trigger `order_inbox_cap` |
| `expired_orders` | what is left after details go: `token`, `seller_id`, `cooking_date` | PK `token` | kept (nothing private) |
| `push_subscriptions` | a browser's web-push subscription **for one order** (0005, D-059): `endpoint`, `p256dh`, `auth`. Never logged, never returned by any route | PK `(seller_id, order_id, endpoint)`; cascade from the order | deleted with the order, when it is cancelled, and when its menu finishes |

### New-menu notices (0032, plan 112, D-113)

| table | purpose | key | retention |
|---|---|---|---|
| `menu_notice_subscriptions` | a phone that turned on "New menus from <kitchen>" in customer Settings: `endpoint`, `p256dh`, `auth`, `language`, `created_at`, `last_order_at` (refreshed after each order). No name, phone or order | PK `(seller_id, endpoint)`; cascade from the seller | **183 days** after `last_order_at`; on turn-off; when a push answers 404/410 |
| `menu_notice_sends` | each seller send for a menu: `menu_id`, `sent_at`, `reached` | PK `(seller_id, menu_id, sent_at)` | only the current menu's rows |

`seq` is `max(seq) + 1` for that order. The caps are enforced in the database (a trigger deletes older rows after each insert), so the repository only ever inserts.

### Closed menus (`past_weeks`)

| table | purpose | key | retention |
|---|---|---|---|
| `past_weeks` | a finished menu: `cooking_date`, `closed_at`, totals (`orders_count`, `cancelled_count`, `income_cents`, `paid_cents`, `unpaid_cents`), `details_dropped_at`, `picture_ref` (0015, plan 064), `chef_summary` (0017, plan 069: JSON `{rows}` of the owner's per-chef figures, written when the menu finishes; NULL for menus finished before, and after a backup restore) | PK `(seller_id, id)` | **totals kept for good**; `picture_ref` kept for the newest 10 menus only (`PAST_MENU_PICTURES_KEPT`), set back to NULL for older ones by the hourly finish job; `chef_summary` kept with the row |
| `past_week_items` | quantity per item in the totals | PK `(seller_id, past_week_id, position)`; cascade | for good |

`hasOrders` in the API is `details_dropped_at IS NULL`.

### Sign-in (rebuilt in 0007, D-085 to D-090)

One login per **person**, who joins kitchens through memberships. 0007 deleted every earlier seller and chef login (D-088); the admin login was kept.

| table | purpose | key | retention |
|---|---|---|---|
| `accounts` | `id` is `admin` or `person:<random>`; `display_name` (people only, D-090); optional password (`password_salt/hash/iterations`, PBKDF2) | PK `id` | kept |
| `memberships` | a person in a kitchen: `role` `owner`, `chef` or `helper` (0010, D-092), `chef_id` (the cook row; required for a chef, never a helper; no FK, the app clears it when the cook is removed) | PK `(account_id, seller_id)` | until removed |
| `devices` | a device: `name`, passkey `credential_id` (unique), public key, counter, transports; all NULL for a password-only device; `last_used_at` | PK `id`; cascade from the account | until revoked or the account goes |
| `sessions` | `token_hash`, `account_id`, `device_id` (NULL for a setup session), `seller_id` (the **active kitchen**; NULL for admin), `via`, `expires_at` | PK `token_hash`; one per device | 30 days, renewed on use; setup session 60 minutes. An expired row is deleted when it is next presented, or at once when the person or device is removed or the kitchen is fully paused. No cron sweep |
| `auth_keys` | invite and recovery keys: `key_hash`, `seller_id`, `role`, `chef_id`, `display_name` of the person to be invited | PK `key_hash` | valid **24 hours**, one device (`KEY_MAX_DEVICES = 1`, D-085); deleted when a chef is removed; the weekly sweep deletes rows 7 days after expiry (plan 098 C10) |
| `auth_key_redemptions` | which browser redeemed a key: one row per key, so a second redemption fails even in a race | PK `key_hash`; cascade | with the key |
| `auth_codes` | add-device codes: `code_hash` (6 digits), `account_id`, `seller_id`, `expires_at`, `used` | PK `id`; cascade from the account | **10 minutes**, one use; the weekly sweep deletes rows 7 days after expiry (plan 098 C10) |
| `auth_attempts` | lockouts, by `scope` (`seller:...`, `device:...`, `find:<seller>:<code>`, `find:ip:<hash>`, `codes:...`) with `fails`, `locked_until`, `updated_at` | PK `scope` | 5 fails lock 15 minutes; a successful sign-in clears its scopes; the hourly cron deletes old `find:` rows |
| `auth_challenges` | one-time WebAuthn challenges (0002) | PK `challenge` | 5 minutes; single use (reading it deletes it); expired rows are deleted at the next register or sign-in start |
| `ip_salts` | (0030) `day` (UTC date) and a random 32-byte `salt` (hex) for the network keys above | PK `day` | rows older than yesterday are deleted by the hourly cron |
| `auth_rate` | request counts per `rate:<clientDeviceId>` (30 per 60 seconds on `/api/auth`) and `log:<hash>` (the log intake) | PK `scope` | `log:` rows older than an hour are deleted on each log write |

### Client error log (0009, plan 026)

| table | purpose | retention |
|---|---|---|
| `client_log` | app, version, slug, path, kind, code, a scrubbed message, user agent, installed or not. No names, notes, codes, tokens, IPs or cookies (D-007) | a ring of the **newest 500**, trimmed in the same batch as each insert; the admin can clear it |

### Remember me (0029, plan 087, D-107)

An optional customer passkey. Separate from the sellers' accounts, sessions and passkeys on purpose: a customer can never reach a seller route. No email, password or phone number. The server never holds a readable address.

| table | purpose | retention |
|---|---|---|
| `customer_accounts` | `id` (random, opaque), `first_name`, `code_salt` (the per-kitchen customer code is `HMAC(code_salt, "customer-code:v1:" + seller)`), `created_at`, `last_used_at`, `last_order_at` | deleted with everything of theirs after **12 idle months** (weekly cron) or by "Delete my saved data" |
| `customer_passkeys` | `credential_id`, public key, counter, transports, `prf` flag | cascade from the account |
| `customer_sessions` | cookie `__Host-customer` (token stored as a SHA-256 hash), 90-day sliding, `setup` = 1 for a phone that joined by code and has no passkey yet (30 minutes to add one) | by `expires_at` (hourly sweep) |
| `customer_challenges` | WebAuthn challenges (`register`, `authenticate`, `add`), 5 minutes | by `expires_at` (hourly sweep) |
| `customer_phone_codes` | the 6-digit "add another phone" code, stored as a hash, 5 minutes, single use | by `expires_at` (hourly sweep) |
| `customer_order_links` | `(account_id, token, seller_id)`: My orders for the account (up to 200). No foreign key to `orders` | dropped when the order details are gone (weekly cron) |
| `customer_kitchen_codes` | only plan 071 device codes adopted with proof (an order with that token, kitchen and code); UNIQUE `(seller_id, code)`. Every other kitchen's code is derived | cascade from the account |
| `customer_sealed_addresses` | the saved delivery address **locked (sealed) on the phone** (WebAuthn PRF, HKDF, AES-GCM): `v`, `iv`, `ct` (at most 2 KB), one per passkey; the server cannot read it | **30 days** after the last confirmed order (hourly sweep); cascade |

`orders.customer_confirmed` (0/1) is set only when the order request carried a valid customer session (a flag in the body is ignored); sellers see "✓ Passkey-confirmed · C-xxxx" and never get the account id.

### Platform settings (0022, plan 046)

| table | purpose | retention |
|---|---|---|
| `short_messages` | plan 086 (migration 0028): `id`, `text_en`, `text_id` (plain, max 90), `audience` (everyone / sellers / customers), `seller_ids` (JSON list, NULL = all kitchens), `created_at`, `expires_at` (ISO), `stopped_at`. A device gets a message while `stopped_at` is NULL and `expires_at` is in the future; the admin list shows the newest 20 | kept (a small log; wiped only by dev reset) |
| `app_settings` | one row (`id = 1`): `maintenance` (0/1), `notice_from`, `notice_until` (ISO instants), `notice_text_en`, `notice_text_id`, and (plan 074, migration 0023) `backup_customer_min`, `backup_seller_min` (default 5 each; 1 to 30 checked by the Worker). No row = all off and 5 / 5. Read by `GET /api/status` and before every write; changed by the admin or the release token | kept; the admin clears the announcement |

## One model, many kinds (plan 098)

One model serves a kitchen, a shop, an event organiser and a community group: the tables and types below are the general model, and a kind changes words, a few rules and two or three screens. **No table, column or type is renamed** (`menus`, `dishes`, `cooking_date`, `past_weeks`, `MenuItem`, `SellerOrder` stay); the docs translate, the code does not. `sellers.kind` arrives with the store (v1.1.0, plan 082 stage 0), replacing the planned `sellers.mode`. Nothing exists in the schema today.

| concept | kitchen (today) | shop (082) | event organiser | community activity | today's table / type (unchanged) |
|---|---|---|---|---|---|
| **Place** (one `kind`, set at creation) | kitchen | shop | organiser | group | `sellers` + `kitchens`; `Seller`, `Kitchen` |
| **Offering** | menu: dated, cut-off, finishes | catalogue: undated, never finishes | event: dated, "sales close" = cut-off, finishes | activity: dated | `menus`; `MenuView` |
| **Item** | dish | product | ticket type (limit = capacity) | spot | `dishes` (library), `menu_items` (copy on the offering); `MenuItem` |
| **Order** | order | order | booking (lines = tickets) | sign-up | `orders` + `order_lines`; `SellerOrder` |
| **Fulfilment** | pickup / delivery | pickup / delivery | entry at the door (= pickup) | attend (= pickup) | `orders.fulfilment` |
| **Hand-over** | scan the QR, Collected | collected / delivered | scan the QR, "Checked in" | attended | `collected_at/by`, the existing scan flow |
| **Closing** | finish, `past_weeks` | monthly archive (082) | event over, past event | past activity | `past_weeks` |
| **Places** | pickup places | counter / shop | venue | venue | `pickup_places` |
| **Team** | owner / chef / helper | owner / helper | owner / door staff (= helper) | organiser / helper | `memberships.role` |

## Hashed, never stored

| what | how it is kept |
|---|---|
| Invite and recovery keys | SHA-256 of the normalised key; shown once |
| Add-device codes | SHA-256 of the 6 digits |
| Session tokens | SHA-256 (`sessions.token_hash`); the raw token lives only in the `__Host-session` cookie |
| Passwords | PBKDF2-SHA256, 100 000 iterations (the Workers maximum), random salt, all three stored |
| Admin setup key | a Worker secret (`ADMIN_SETUP_KEY`), never in the database |
| Passkeys | only credential id, public key, counter and transports (public data) |
| Client address | the "find my order", log-intake and phone-code limiters keep `HMAC-SHA256(daily salt, CF-Connecting-IP)` (`worker/auth/ipKey.ts`) in `auth_attempts` / `auth_rate`. The salt is 32 random bytes per UTC day in `ip_salts`; only today's and yesterday's are kept (hourly sweep), so a stored key cannot be reversed to an address and does not match across days. Counts restart at midnight UTC. The address itself is never stored |
| Customer (Remember me) session tokens, add-phone codes | SHA-256 (`customer_sessions.token_hash`, `customer_phone_codes.code_hash`); the raw token lives only in the `__Host-customer` cookie |
| Order `token` | stored **in the clear**: the seller must be able to show the customer's link. It is a long random capability, unique, and never listed across customers. |

**Delivery address (D-099, plan 071; amends D-007 for addresses only):** `orders.address_enc` holds one JSON value `{street, suburb, postcode, notes?, lat?, lng?}` encrypted with **AES-GCM 256** (Web Crypto, a random 12-byte IV per value, stored `iv.ciphertext` in base64). The key is the secret `ADDRESS_KEY` (never in the database or a backup). The repository sees only the ciphertext (`setOrderAddress`, `orderAddresses`); the routes encrypt and decrypt. It is decrypted only for the kitchen's signed-in team (owner, chef, helper) on `/api/seller/orders*`; customer answers carry only `addressState` (`saved` / `unreadable`); the backup, the CSV, labels, the public menu and logs never include it. It is set to NULL when the order is cancelled (in `changeStatements`), by "Delete address now", and one day after the menu finishes (hourly `runAddressSweep`, using `past_weeks.closed_at`). If the key is lost or changed, a stored value reads as "unavailable" and the customer enters it again.

**Never stored (D-007):** a customer's phone number or email (also with Remember me, D-107). The cloud holds only the customer's first name, an optional order note (the UI warns not to put private details there), the items and the statuses. The seller's own WhatsApp number is public (D-027) and is stored. Push subscriptions are browser endpoints, not phone numbers, and belong to an order, never to a person.

**On the customer's device only:** the order tokens that My orders reads (`localStorage`), the last kitchen visited, language and theme choices, and drafts of half-typed forms (`draft:v1:<slug>:<form>:<id>`, 7 days). The device's own sign-in cookie and a random browser id (for lockouts) are the only identity the seller side keeps there.

## Retention

| what | rule | who runs it |
|---|---|---|
| Live orders | until the menu finishes (the seller finishes it, or the **hourly** cron does at midnight after the cooking day in the kitchen's own `time_zone`, D-069) | seller / `runAutoFinish` |
| Closed menu, order details | kept until `cooking_date + 4 weeks` (`ORDER_DETAIL_WEEKS`), then orders (with lines, audit, inbox, push rows) are deleted, `details_dropped_at` is set, and an `expired_orders` stub keeps token and date so the old link says "archived" | `dropExpiredDetails`: lazily when a seller opens past menus or a customer opens an old order, and the Monday 03:00 UTC cron for every kitchen. Idempotent |
| Totals | `past_weeks` and `past_week_items` kept for good | |
| Past menu pictures | the newest **10** keep theirs; the rest go back to NULL and their R2 file is deleted unless still used | hourly finish job (`finishDueMenus`, `deleteUnusedPictures`) |
| Day sales log | **10 weeks** per kitchen | weekly cron |
| Client error log | newest **500** | each insert |
| Remember me (D-107) | locked address 30 days after the last confirmed order; the whole account after 12 idle months; sessions, challenges and phone codes by expiry; order links when their order details are gone | hourly `sweepCustomerHourly`, weekly `sweepCustomerWeekly` (in `scheduled.ts`) |
| Delivery address (`orders.address_enc`) | **one day after the menu finishes**, on cancel, or on "Delete address now" | hourly cron (`runAddressSweep`), `changeStatements`, the delete-address route |
| "Find my order" tries | wrong-try rows that are older than the lock time and not locked | hourly cron (`runAttemptSweep`) |
| New-menu notices (plan 112) | phones 183 days after their last order; send rows of any menu but the current one | hourly cron (`dropStaleMenuNotices` in `runRetention`) |
| Message log, made counts | belong to one menu; rows of any other menu are dropped when a new one is written | repository |
| Invites (24 h), codes (10 min), challenges (5 min), sessions (30 days) | expire by their own `expires_at`; see the table above for when the row is actually deleted | |

## R2 object rules

Images live in the `IMAGES` bucket under `sellers/<sellerId>/...`, and `/images/<key>` streams them (content-hashed, cached a year). D1 holds only the ref. When a ref stops being used (an upload replaces it, a slot is removed, a menu picture is replaced or pruned), `dropUnusedImageRefs` ([`worker/images/r2.ts`](../../worker/images/r2.ts)) deletes the object **unless something still shows it**: a kitchen slot, a saved set's copy, the current menu's picture, or a past menu's picture. It only ever deletes keys under that seller's own prefix. Paths under `/samples/` are static files, not R2 objects.

## Entity relationships

```
sellers 1──1 kitchens
        1──1 kitchen_settings
        1──* kitchen_images
        1──* chefs
        1──1 menus 1──* menu_items (copies of dishes)   menus *──* pickup_places (menu_pickup_places)
        1──* dishes            1──* saved_sets 1──* saved_set_dishes, 1──* saved_set_images
        1──* message_log, made_counts, day_sales   (keyed by menu id, no FK)
        1──* past_weeks 1──* past_week_items
        1──* orders ─ past_week_id (NULL = live) ─> past_weeks
                 orders 1──* order_lines, order_audit (4), order_inbox (20), push_subscriptions
        1──* expired_orders (token)
accounts 1──* memberships *──1 sellers        (role owner / chef / helper)
accounts 1──* devices 1──0..1 sessions        accounts 1──* sessions (setup: no device)
accounts 1──* auth_codes        sellers 1──* auth_keys 1──1 auth_key_redemptions
auth_attempts, auth_challenges, auth_rate, client_log, app_settings, short_messages   (stand-alone)
```

## Repository

`worker/repo/Repository.ts` is the only thing the routes talk to. It is **operation-level**: each method is one thing the routes do ("place an order", "finish the menu", "redeem a key"), not one SQL statement, because those operations must be atomic (a D1 `batch`) and their rules belong next to the writes. Everything is `async` and no SQL types appear in it. Groups: `sellers` and `sellerBySlug` / `sellerById` handles (menus, dishes, sets, places, chefs, images, settings, orders, day sales, made counts, messages, backup), `lookupByToken(s)`, `auth`, `log` (client log) and `dev`. The D1 implementation is [`worker/db/`](../../worker/db/); tests in `mocks/` run it on a local D1 through `mocks/impl.ts` ([D-047](../decisions/README.md)).

Things worth knowing:

- **D1 caps `LIKE`/`GLOB` patterns at 50 bytes**, so long patterns in a `CHECK` fail on insert.
- **Rules run in TypeScript on rows read from D1**; an operation that writes several rows is one `db.batch` (one transaction). The first statement of an order write re-checks the portion limits inside the transaction, so two orders for the last portion cannot both win (`mocks/portionRace.test.ts`).
- **Round trips cost**: reads are batched (`Db.reads`). The free plan allows 50 D1 queries per invocation; `mocks/queries.test.ts` holds every route under 40 with 100 orders in the week. The full budget and how to stay inside it: [state-and-data-flow.md](state-and-data-flow.md#10-database-trips-the-budget).
- `worker/db/migrate.ts` splits statements itself (a `CREATE TRIGGER ... END;` stays whole) and records applied files in wrangler's `d1_migrations` table.
- `Repository.dev.reset` refuses to run unless built with `devTools: true`, which only tests and the local server set.
- A new seller's first menu is for the coming Saturday with the default cut-off (the evening before, 21:00 in the kitchen's time zone), from `shared/dates.ts` and `shared/zone.ts`. Times are stored as instants (UTC offset kept in the ISO string); screens show them in the viewer's device zone (D-101, plan 077). Pickup windows stay the kitchen's wall-clock `HH:MM` on the cooking date and are converted to the device's clock for display and entry.
