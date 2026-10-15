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
| `kitchens` | the public identity: `name`, `tagline_en/id`, `banner_image_url`, `banner_background` (`#rrggbb`), `image_alt_en/id` | PK `seller_id` | kept |
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
| `dishes` | "Your dishes" library: names, descriptions, size, `price_cents`, `portion_limit`, `chef_id` (NULL = whole kitchen), `preorder`, `day_stock` (0011), `last_used_at` | PK `(seller_id, id)` | until removed |
| `menu_items` | a menu dish: a **copy** with its own price, limit, chef, `sold_out`, `preorder`, `day_stock`; `dish_id` says where it came from and has no foreign key (D-062) | PK `(seller_id, id)` | with the menu |
| `saved_sets` | a named list of dishes (max 5): `name`, `position`, `times_used`, banner colour and alt text | PK `(seller_id, id)` | until removed |
| `saved_set_dishes` | the library dishes in a set | PK `(seller_id, set_id, position)`; cascade from set and dish | with the set |
| `saved_set_images` | a set's own copy of image refs, one row per slot | PK `(seller_id, set_id, slot)` | with the set |
| `message_log` | what the seller sent per group (`place:<id>`, `delivery`, `order:<code>`): type, minutes, optional text, `sent_count`. No customer data | PK `(seller_id, id)` | only the current menu's rows; a write for a new menu deletes the others |
| `made_counts` | how many of each dish are cooked (Cook screen, shared by all devices), written as increments | PK `(seller_id, menu_id, item_id)` | same: the old menu's rows go on the next write |
| `day_sales` | selling on the day (D-083): `kind` (`sale`, `count`, `undo`), `change`, `stock_after`, `by_account`, `by_name` (kept as text because accounts can go), `undone`, `undoes` (an undo reverses one sale, once) | PK `id`; UNIQUE `undoes` | **10 weeks** per kitchen, cut by the weekly cron (`dropOldDaySales`) |

### Orders

Live orders have `past_week_id` NULL. Finishing the menu sets it (the finished menu's id), so the order leaves the live list but stays readable by its token (D-044). Nothing is copied.

| table | purpose | key | retention |
|---|---|---|---|
| `orders` | one order: `code` (6 chars), `token` (private link), `first_name`, `language`, `fulfilment`, `note`, `status`, `paid`, `locked`, `wa_received`, `is_returning`, `changed`, `entered_by_role/name`, `packed` (kept apart from status, D-066), `collected_at/by`, `pickup_place_id` (no FK; NULL = the menu's first place), `sample` (demo kitchens), `address_enc` (0018, plan 071: the delivery address, **encrypted**, see below; NULL = none), `address_changed` / `address_seen` (0020 / 0021, plan 071: flags only, the old address is never kept; a customer's real address change sets changed=1, seen=0; a team member's "Got it" sets seen=1; exposed as `addressChanged: 'new' | 'seen'` to the team and `addressChange: 'waiting' | 'seen'` to the customer), `customer_code` (0019, plan 071: the customer phone's anonymous random code for this kitchen; returned in seller order reads only; NULL = none, old apps send none), `past_week_id` | PK `(seller_id, id)`; UNIQUE `(seller_id, code)`; UNIQUE `token` | live until the menu finishes, then **4 weeks after the cooking date**, then deleted (a stub stays in `expired_orders`) |
| `order_lines` | the item snapshot (D-020): `item_id` (no FK), names, size, `price_cents`, `qty`, `ticked` (packing tick) | PK `(seller_id, order_id, position)`; cascade | with the order |
| `order_audit` | last 4 changes (D-013): who, what, `diff_json` | PK `(seller_id, order_id, seq)`; cascade | **4 per order**, by trigger `order_audit_cap` |
| `order_inbox` | customer-visible messages (keys and data only) | PK `(seller_id, order_id, seq)`; cascade | **20 per order**, by trigger `order_inbox_cap` |
| `expired_orders` | what is left after details go: `token`, `seller_id`, `cooking_date` | PK `token` | kept (nothing private) |
| `push_subscriptions` | a browser's web-push subscription **for one order** (0005, D-059): `endpoint`, `p256dh`, `auth`. Never logged, never returned by any route | PK `(seller_id, order_id, endpoint)`; cascade from the order | deleted with the order, when it is cancelled, and when its menu finishes |

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
| `auth_keys` | invite and recovery keys: `key_hash`, `seller_id`, `role`, `chef_id`, `display_name` of the person to be invited | PK `key_hash` | valid **24 hours**, one device (`KEY_MAX_DEVICES = 1`, D-085); deleted when a chef is removed |
| `auth_key_redemptions` | which browser redeemed a key: one row per key, so a second redemption fails even in a race | PK `key_hash`; cascade | with the key |
| `auth_codes` | add-device codes: `code_hash` (6 digits), `account_id`, `seller_id`, `expires_at`, `used` | PK `id`; cascade from the account | **10 minutes**, one use |
| `auth_attempts` | lockouts, by `scope` (`seller:...`, `device:...`, `find:<seller>:<code>`, `find:ip:<hash>`, `codes:...`) with `fails`, `locked_until`, `updated_at` | PK `scope` | 5 fails lock 15 minutes; a successful sign-in clears its scopes; the hourly cron deletes old `find:` rows |
| `auth_challenges` | one-time WebAuthn challenges (0002) | PK `challenge` | 5 minutes; single use (reading it deletes it); expired rows are deleted at the next register or sign-in start |
| `auth_rate` | request counts per `rate:<clientDeviceId>` (30 per 60 seconds on `/api/auth`) and `log:<hash>` (the log intake) | PK `scope` | `log:` rows older than an hour are deleted on each log write |

### Client error log (0009, plan 026)

| table | purpose | retention |
|---|---|---|
| `client_log` | app, version, slug, path, kind, code, a scrubbed message, user agent, installed or not. No names, notes, codes, tokens, IPs or cookies (D-007) | a ring of the **newest 500**, trimmed in the same batch as each insert; the admin can clear it |

### Platform settings (0022, plan 046)

| table | purpose | retention |
|---|---|---|
| `app_settings` | one row (`id = 1`): `maintenance` (0/1), `notice_from`, `notice_until` (ISO instants), `notice_text_en`, `notice_text_id`, and (plan 074, migration 0023) `backup_customer_min`, `backup_seller_min` (default 5 each; 1 to 30 checked by the Worker). No row = all off and 5 / 5. Read by `GET /api/status` and before every write; changed by the admin or the release token | kept; the admin clears the announcement |

## Hashed, never stored

| what | how it is kept |
|---|---|
| Invite and recovery keys | SHA-256 of the normalised key; shown once |
| Add-device codes | SHA-256 of the 6 digits |
| Session tokens | SHA-256 (`sessions.token_hash`); the raw token lives only in the `__Host-session` cookie |
| Passwords | PBKDF2-SHA256, 100 000 iterations (the Workers maximum), random salt, all three stored |
| Admin setup key | a Worker secret (`ADMIN_SETUP_KEY`), never in the database |
| Passkeys | only credential id, public key, counter and transports (public data) |
| Client address | the "find my order" limiter keeps a SHA-256 of `CF-Connecting-IP` in `auth_attempts`, and the log intake limiter one in `auth_rate`; both are swept (see Retention) |
| Order `token` | stored **in the clear**: the seller must be able to show the customer's link. It is a long random capability, unique, and never listed across customers. |

**Delivery address (D-099, plan 071; amends D-007 for addresses only):** `orders.address_enc` holds one JSON value `{street, suburb, postcode, notes?, lat?, lng?}` encrypted with **AES-GCM 256** (Web Crypto, a random 12-byte IV per value, stored `iv.ciphertext` in base64). The key is the secret `ADDRESS_KEY` (never in the database or a backup). The repository sees only the ciphertext (`setOrderAddress`, `orderAddresses`); the routes encrypt and decrypt. It is decrypted only for the kitchen's signed-in team (owner, chef, helper) on `/api/seller/orders*`; customer answers carry only `addressState` (`saved` / `unreadable`); the backup, the CSV, labels, the public menu and logs never include it. It is set to NULL when the order is cancelled (in `changeStatements`), by "Delete address now", and one day after the menu finishes (hourly `runAddressSweep`, using `past_weeks.closed_at`). If the key is lost or changed, a stored value reads as "unavailable" and the customer enters it again.

**Never stored (D-007):** a customer's phone number or email. The cloud holds only the customer's first name, an optional order note (the UI warns not to put private details there), the items and the statuses. The seller's own WhatsApp number is public (D-027) and is stored. Push subscriptions are browser endpoints, not phone numbers, and belong to an order, never to a person.

**On the customer's device only:** the order tokens that My orders reads (`localStorage`), the last kitchen visited, language and theme choices, and drafts of half-typed forms (`draft:v1:<slug>:<form>:<id>`, 7 days). The device's own sign-in cookie and a random browser id (for lockouts) are the only identity the seller side keeps there.

## Retention

| what | rule | who runs it |
|---|---|---|
| Live orders | until the menu finishes (the seller finishes it, or the **hourly** cron does at midnight Melbourne after the cooking day, D-069) | seller / `runAutoFinish` |
| Closed menu, order details | kept until `cooking_date + 4 weeks` (`ORDER_DETAIL_WEEKS`), then orders (with lines, audit, inbox, push rows) are deleted, `details_dropped_at` is set, and an `expired_orders` stub keeps token and date so the old link says "archived" | `dropExpiredDetails`: lazily when a seller opens past menus or a customer opens an old order, and the Monday 03:00 UTC cron for every kitchen. Idempotent |
| Totals | `past_weeks` and `past_week_items` kept for good | |
| Past menu pictures | the newest **10** keep theirs; the rest go back to NULL and their R2 file is deleted unless still used | hourly finish job (`finishDueMenus`, `deleteUnusedPictures`) |
| Day sales log | **10 weeks** per kitchen | weekly cron |
| Client error log | newest **500** | each insert |
| Delivery address (`orders.address_enc`) | **one day after the menu finishes**, on cancel, or on "Delete address now" | hourly cron (`runAddressSweep`), `changeStatements`, the delete-address route |
| "Find my order" tries | wrong-try rows that are older than the lock time and not locked | hourly cron (`runAttemptSweep`) |
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
auth_attempts, auth_challenges, auth_rate, client_log, app_settings   (stand-alone)
```

## Repository

`worker/repo/Repository.ts` is the only thing the routes talk to. It is **operation-level**: each method is one thing the routes do ("place an order", "finish the menu", "redeem a key"), not one SQL statement, because those operations must be atomic (a D1 `batch`) and their rules belong next to the writes. Everything is `async` and no SQL types appear in it. Groups: `sellers` and `sellerBySlug` / `sellerById` handles (menus, dishes, sets, places, chefs, images, settings, orders, day sales, made counts, messages, backup), `lookupByToken(s)`, `auth`, `log` (client log) and `dev`. The D1 implementation is [`worker/db/`](../../worker/db/); tests in `mocks/` run it on a local D1 through `mocks/impl.ts` ([D-047](../decisions/README.md)).

Things worth knowing:

- **D1 caps `LIKE`/`GLOB` patterns at 50 bytes**, so long patterns in a `CHECK` fail on insert.
- **Rules run in TypeScript on rows read from D1**; an operation that writes several rows is one `db.batch` (one transaction). The first statement of an order write re-checks the portion limits inside the transaction, so two orders for the last portion cannot both win (`mocks/portionRace.test.ts`).
- **Round trips cost**: reads are batched (`Db.reads`). The free plan allows 50 D1 queries per invocation; `mocks/queries.test.ts` holds every route under 40 with 100 orders in the week. The full budget and how to stay inside it: [state-and-data-flow.md](state-and-data-flow.md#10-database-trips-the-budget).
- `worker/db/migrate.ts` splits statements itself (a `CREATE TRIGGER ... END;` stays whole) and records applied files in wrangler's `d1_migrations` table.
- `Repository.dev.reset` refuses to run unless built with `devTools: true`, which only tests and the local server set.
- A new seller's first menu is for the coming Saturday with the default cut-off (the evening before, 21:00 Melbourne time), from `shared/dates.ts`.
