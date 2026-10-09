# Data model (D1)

Stage 8.1a ([D-046](../decisions/README.md)). The SQL is [migrations/0001_init.sql](../../migrations/0001_init.sql); this page and that file must say the same thing. The code that reads and writes it sits behind `worker/repo/Repository.ts` (see [Repository](#repository)).

## Conventions

| topic | rule |
|---|---|
| Engine | Cloudflare D1 (SQLite). Every table is `STRICT`. Foreign keys are on. |
| Money | integer **cents**, column suffix `_cents`, never negative. No floats anywhere. |
| Timestamps | **ISO-8601 text**, never epoch numbers. Instants the server makes are UTC with milliseconds (`2026-10-09T05:52:39.123Z`), so they sort and compare as text (expiry, lockout). The one exception is `weeks.cutoff_at`: the seller types it with an offset (`2026-10-09T21:00:00+11:00`) and it is kept exactly as given; compare it in code (`Date.parse`) or with SQLite `unixepoch()`, never as text. Dates are `YYYY-MM-DD` text. |
| Booleans | `INTEGER` 0 or 1 with a `CHECK`. |
| Bilingual text | two columns, `<name>_en` and `<name>_id`. |
| Ids | text. Seller-owned ids (`menu_items.id`, `chefs.id`, `orders.id`...) are only unique **within a seller**, so those tables use a composite primary key `(seller_id, id)`. Order `token` is globally unique. |
| Enums | `TEXT` with a `CHECK ... IN (...)`; the values are the TypeScript unions in `shared/`. |
| Order of lists | an explicit `position` column (items, chefs, sets, pickup points, order lines), never "insertion order". |

## Per seller (D-036)

Every table below the "Sellers" heading, except `sellers` itself and the sign-in tables marked "global", carries `seller_id` and **every repository query filters by it**. A seller handle in the repository is created from one seller row and cannot read another seller's rows. The only cross-seller reads are the ones D-036 allows: the order lookup by private `token` (customer links, My orders) and the admin's seller list.

Sign-in tables (`accounts`, `devices`, `sessions`, `auth_keys`, `auth_codes`) carry a nullable `seller_id` (NULL only for the admin) so "all devices of seller X" is a direct filter. `auth_attempts` is keyed by a scope string (`seller:<id>` or `device:<clientId>`).

## Tables

### Sellers and kitchen

| table | purpose | key | per seller | retention |
|---|---|---|---|---|
| `sellers` | one row per kitchen: `id`, `slug` (unique, lowercase, the customer link, D-037), `name`, `created_at` | PK `id`; UNIQUE `slug` | the root | kept |
| `kitchens` | the public kitchen identity: `name`, `tagline_en/id`, `banner_image_url`, `banner_background` (`#rrggbb`), `image_alt_en/id` | PK `seller_id` | yes, 1 row | kept |
| `kitchen_settings` | `whatsapp_number` (the seller's own, public, D-027), `post_greeting_en/id`, `post_closing_en/id`, `ordering_open` | PK `seller_id` | yes, 1 row | kept |
| `kitchen_images` | one row per filled image slot: `slot` (`railImage`, `railIcon`, `desktopBanner`, `phoneBanner`, `bannerBackgroundImage`), `ref` (a path, a dev data URL, later an R2 key), `updated_at` | PK `(seller_id, slot)` | yes | kept; replaced on upload |
| `chefs` | the seller's chef list (D-012): `id`, `name`, `position` | PK `(seller_id, id)` | yes | kept until removed |

### The current week and its menu

| table | purpose | key | per seller | retention |
|---|---|---|---|---|
| `weeks` | the one open week: `cooking_date`, `cutoff_at`, `status` (`draft`/`published`), `delivery_available`, `delivery_note_en/id` | PK `seller_id` | yes, 1 row | rolled forward 7 days when the week is closed |
| `pickup_points` | the week's pickup points as a list (D-008; one used today, up to 5 later): `place`, `directions_en/id`, `window_start`, `window_end`, `position` | PK `(seller_id, id)` | yes | with the week |
| `menu_items` | the week's items (max 10): names, descriptions, size, `price_cents`, `portion_limit` (NULL = unlimited), `chef_id` (NULL = none), `sold_out` (manual switch, D-020), `position` | PK `(seller_id, id)`; FK `(seller_id, chef_id)` to `chefs` | yes | sold-out flags cleared when the week closes |
| `saved_sets` | saved menu sets (max 5, D-027): `name`, `position`, plus the banner colour and image alt text that were current | PK `(seller_id, id)` | yes | kept until removed |
| `saved_set_items` | a set's items (same columns as `menu_items`, no sold-out flag), `position` | PK `(seller_id, set_id, position)`; cascade from the set | yes | with the set |
| `saved_set_images` | a set's image refs, one row per slot | PK `(seller_id, set_id, slot)`; cascade from the set | yes | with the set |

### Orders

Live orders have `past_week_id` NULL. Closing a week sets it, so the order leaves the seller's live list but stays readable by its token (D-044). Nothing is copied.

| table | purpose | key | per seller | retention |
|---|---|---|---|---|
| `orders` | one order: `code` (6 chars), `token` (private link), `first_name`, `language`, `fulfilment`, `note`, `status`, `paid`, `locked`, `wa_received`, `is_returning`, `changed`, `entered_by_role/name` (seller- or chef-entered, D-010), `past_week_id`, `created_at`, `updated_at` | PK `(seller_id, id)`; UNIQUE `(seller_id, code)`; UNIQUE `token`; FK `(seller_id, past_week_id)` to `past_weeks`, cascade | yes | live until the week is closed, then **4 weeks after the cooking date**, then the row and its children are deleted (a stub is left in `expired_orders`) |
| `order_lines` | the item snapshot (D-020): `item_id` (no foreign key on purpose), names, size, `price_cents`, `qty`, `position` | PK `(seller_id, order_id, position)`; cascade from the order | yes | with the order |
| `order_audit` | last 4 changes (D-013): `seq`, `by_role` (`customer`/`seller`/`chef`), `by_name`, `what`, `detail`, `diff_json` (the language-neutral `AuditDiff`), `at` | PK `(seller_id, order_id, seq)`; cascade | yes | capped at **4 per order** by the trigger `order_audit_cap`; deleted with the order |
| `order_inbox` | customer-visible messages, keys and data only: `seq`, `at`, `kind`, `status`, `text_key`, `text`, `minutes` | PK `(seller_id, order_id, seq)`; cascade | yes | capped at **20 per order** by the trigger `order_inbox_cap`; deleted with the order |
| `expired_orders` | what is left once details are dropped (D-044): `token`, `seller_id`, `cooking_date` | PK `token` | yes | kept (a token and a date, nothing private) |

`seq` is `max(seq) + 1` for that order. The caps are enforced in the database: the trigger deletes every row with `seq <= new.seq - 4` (audit) or `- 20` (inbox) right after an insert, so the repository only ever inserts.

### Closed weeks

| table | purpose | key | per seller | retention |
|---|---|---|---|---|
| `past_weeks` | a closed week: `cooking_date`, `closed_at`, the totals (`orders_count`, `cancelled_count`, `income_cents`, `paid_cents`, `unpaid_cents`), `details_dropped_at` | PK `(seller_id, id)` | yes | **totals kept for good**; `details_dropped_at` is NULL while the orders are kept, set by retention |
| `past_week_items` | quantity per item in the totals, in first-seen order: `item_id`, `name_en/id`, `qty`, `position` | PK `(seller_id, past_week_id, position)`; cascade | yes | with the week (for good) |

`hasOrders` in the API is `details_dropped_at IS NULL`.

### Sign-in (D-011, D-013, D-027 row 1)

| table | purpose | key | per seller | retention |
|---|---|---|---|---|
| `accounts` | one per person-role: `id` (`admin`, `seller:<sellerId>`, `chef:<sellerId>:<chefId>`), `role`, `seller_id`, `chef_id`, `password_salt/hash/iterations` (PBKDF2, NULL if passkey only) | PK `id`; FK `(seller_id, chef_id)` to `chefs`, **cascade** | yes (admin: global) | kept; removing a chef deletes the account and, by cascade, everything below |
| `devices` | a registered device: `name`, `credential_id` (unique), `credential_public_key`, `credential_counter`, `credential_transports` (WebAuthn, public data only), `created_at`, `last_used_at` | PK `id`; FK `account_id`, cascade | yes (admin: NULL) | until revoked or the account goes |
| `sessions` | `token_hash` (SHA-256), `account_id`, `device_id` (NULL for a setup session), `via`, `created_at`, `expires_at` | PK `token_hash`; UNIQUE `device_id` (one session per device) | yes (admin: NULL) | 30 days, renewed on use (setup session: 60 minutes); expired rows purged by the weekly cron |
| `auth_keys` | invite and recovery keys: `key_hash`, `kind`, `expires_at` | PK `key_hash`; FK `account_id`, cascade | yes (admin: NULL) | 24 hours, then purged |
| `auth_key_redemptions` | which browsers redeemed a key (max 3): `client_device_id`, `redeemed_at` | PK `(key_hash, client_device_id)`; cascade | via the key | with the key |
| `auth_codes` | add-device codes: `code_hash`, `expires_at`, `used` | PK `id`; FK `account_id`, cascade | yes (admin: NULL) | 10 minutes, one use, then purged |
| `auth_attempts` | lockouts: `scope`, `fails`, `locked_until` | PK `scope` | global (scope names the seller or browser) | 5 fails lock for 15 minutes; rows past `locked_until` are purged |

## Hashed, never stored

| what | how it is kept |
|---|---|
| Invite and recovery keys | SHA-256 of the normalised key (`auth_keys.key_hash`); the key is shown once |
| Add-device codes | SHA-256 of the 6 digits (`auth_codes.code_hash`) |
| Session tokens | SHA-256 (`sessions.token_hash`); the raw token lives only in the `__Host-` cookie |
| Passwords | PBKDF2-SHA256, 100 000 iterations (the Workers maximum), 16-byte random salt, all three stored |
| Admin setup key | a Worker secret (`ADMIN_SETUP_KEY`), never in the database |
| Passkeys | only the credential id, public key, counter and transports (public data) |
| Order `token` | stored **in the clear**: the seller must be able to show the customer's link. It is a long random capability, unique, and never listed across customers. |

**Never stored (D-007):** a customer's phone number, delivery address or email, and any IP address. The cloud holds only the customer's chosen first name, an optional order note (D-018: the UI warns not to put private details there), the items and the statuses. The seller's own WhatsApp number is public (D-027) and is stored.

## Retention (D-027 row 6, D-044)

1. **Live orders:** until the seller closes the week.
2. **Closed week, order details:** kept until `cooking_date + 4 weeks` (`ORDER_DETAIL_WEEKS`). Then the order rows (with lines, audit and inbox, by cascade) are deleted, `past_weeks.details_dropped_at` is set, and one `expired_orders` row per order keeps the token and the cooking date, so the old link says "archived" instead of "not found".
3. **Totals:** `past_weeks` and `past_week_items` are kept for good.
4. **Sign-in leftovers:** expired sessions, keys, codes and finished lockouts are purged.
5. **How it runs:** the repository applies rule 2 lazily on every read of past weeks (as the mock does today); stage 8.4 adds the weekly cron that runs the same function.

## Entity relationships

```
sellers 1──1 kitchens
        1──1 kitchen_settings
        1──* kitchen_images
        1──* chefs ─────────────┐ (menu_items.chef_id, saved_set_items.chef_id, accounts.chef_id)
        1──1 weeks
        1──* pickup_points
        1──* menu_items ─ chef_id ─> chefs
        1──* saved_sets 1──* saved_set_items, 1──* saved_set_images
        1──* past_weeks 1──* past_week_items
        1──* orders ─ past_week_id (NULL = live) ─> past_weeks
                 orders 1──* order_lines   (item_id is a snapshot, no FK)
                 orders 1──* order_audit   (newest 4)
                 orders 1──* order_inbox   (newest 20)
        1──* expired_orders (token)
        1──* accounts (admin: seller_id NULL) 1──* devices 1──0..1 sessions
                                              accounts 1──* sessions (setup: no device)
                                              accounts 1──* auth_keys 1──* auth_key_redemptions
                                              accounts 1──* auth_codes
auth_attempts   (stand-alone, by scope)
```

## Queries by screen (why the indexes exist)

| screen / call | query | index used |
|---|---|---|
| any request: seller from the link `/<slug>` | `sellers WHERE slug = ?` | UNIQUE `slug` |
| customer menu | kitchen, settings, week, pickup points, items `ORDER BY position`; portions used per item = `SUM(qty)` of `order_lines` joined to live, non-cancelled `orders` | PKs by `seller_id`; `menu_items_by_position`; `order_lines_by_item`, `orders_by_status` |
| place an order | unique code per seller; insert order + lines + audit + inbox in one batch | UNIQUE `(seller_id, code)`, UNIQUE `token` |
| customer order page, change, cancel | `orders WHERE token = ?` (then `expired_orders WHERE token = ?`) | UNIQUE `token`; PK `expired_orders.token` |
| My orders (up to 20 tokens) | `orders WHERE token IN (...)`, then `expired_orders` for the misses | UNIQUE `token` |
| seller orders list, cook list, labels, CSV, hand-over | live orders newest first, with lines, audit, inbox | `orders_by_week`; child PKs start `(seller_id, order_id)` |
| seller order by code (status, paid, lock, nudge, updates) | `orders WHERE seller_id = ? AND code = ?` | UNIQUE `(seller_id, code)` |
| bulk update to many orders | the same lookup per code, in one batch | same |
| menu editor, chefs, sets, images, settings, week | PK lookups per seller | PKs |
| delete an item | does a live, non-cancelled order use it? | `order_lines_by_item` |
| close week | totals from live orders; set `past_week_id`; insert `past_weeks` + items; roll `weeks` forward | `orders_by_week` |
| past weeks list / detail | `past_weeks WHERE seller_id = ? ORDER BY closed_at DESC`; orders of one week | `past_weeks_by_closed`, `orders_by_week` |
| retention | `past_weeks WHERE details_dropped_at IS NULL AND cooking_date < ?` | `past_weeks_retention` |
| backup export / restore | every row of one seller; restore deletes and re-inserts in one batch | PKs by `seller_id` |
| session check (every seller call) | `sessions WHERE token_hash = ?`, then its account and device | PK `token_hash` |
| sign in again on a device | replace that device's session | UNIQUE `sessions_one_per_device` |
| sign in by passkey | `devices WHERE credential_id = ?` | UNIQUE `credential_id` |
| sign in by password | account by `id` | PK |
| devices screen (own) / admin per seller | `devices WHERE account_id = ?` / `WHERE seller_id = ?` | `devices_by_account`, `devices_by_seller` |
| redeem invite or recovery key | `auth_keys WHERE key_hash = ?` and its redemptions | PK, PK |
| redeem add-device code | `auth_codes WHERE code_hash = ? AND used = 0` | `auth_codes_by_hash` |
| lockout check | `auth_attempts WHERE scope IN (...)` | PK `scope` |
| admin: does an admin exist; seller list | `devices` joined to admin account; `sellers ORDER BY created_at` | `accounts` PK; table is tiny |
| chef device count / sign out a chef | `devices WHERE account_id = ?` | `devices_by_account` |
| purge expired sign-in rows (cron) | by `expires_at` / `locked_until` | `sessions_by_expiry`, `auth_attempts_by_lock` |

## Repository

`worker/repo/Repository.ts` is the only thing the routes talk to. It is **operation-level**: each method is one thing the routes do today ("place an order", "close the week", "redeem a key"), not one SQL statement, because those operations must be atomic (a D1 `batch`) and their rules (limits, statuses, lockouts) belong next to the writes. Everything is `async` and no SQL or storage types appear in it.

- 8.1a: the existing in-memory store (`worker/mock/store.ts`, `worker/mock/auth.ts`) implements it through `worker/repo/memory.ts`.
- 8.1b (built): the D1 implementation is `worker/db/` (`createD1Repository(d1, { now, adminSetupKey, ... })`); the contract suites in `mocks/` run against both implementations through `mocks/impl.ts`. The Worker routes still use the mock until 8.4.
- Groups: `sellers`, `seller(...)` handle (menu, week, chefs, sets, images, settings, backup, orders), `lookupByToken`, `auth`, `dev`.

### What 8.1b learned

- **D1 caps `LIKE`/`GLOB` patterns at 50 bytes.** The `#rrggbb` check in `0001_init.sql` was a 67-byte `GLOB` and failed on insert; it is now `length = 7`, a leading `#`, and `NOT GLOB '*[^0-9a-fA-F]*'`. (The migration was not applied anywhere yet, so it was edited in place.)
- **`exec()` is per line**, so `worker/db/migrate.ts` splits statements itself (a `CREATE TRIGGER ... END;` block stays whole) and records applied files in wrangler's own `d1_migrations` table; `wrangler d1 migrations list --local` agrees with it.
- **Local state paths differ:** the wrangler CLI keeps `--persist-to <dir>` under `<dir>/v3`; `getPlatformProxy` uses the path as given. The seed script passes `<dir>/v3` so both see the same database; the test harness uses private directories.
- **Rules run in TypeScript on rows read from D1** (ported from `worker/mock/store.ts` and `auth.ts`); each operation that writes several rows is one `db.batch` (one transaction). A limit check reads the used portions and then writes, so two orders landing in the same millisecond could both pass; the Durable Object in 8.3 serialises writes per seller, which closes that window.
- **Round trips cost:** locally about 4 ms per statement call and about 2.5 ms per written statement, so reads are batched (`Db.reads`) and a menu read is one trip. Check the per-invocation D1 query limit of the Workers plan before 8.4.
- `Repository.dev.reset` deletes every row; the D1 repository refuses it (and sample orders) unless built with `devTools: true`, which only tests set.
- A new seller's first week copies the Onde Onde dates, exactly as the mock does (`blankFixture`); a real default (next Saturday) is an 8.4 decision.

## Deliberate gaps

- Image refs hold a path or a dev data URL for now; stage 8.3 moves bytes to R2 and the column holds the key.
- No table for Durable Object state (stage 8.3 uses the object's own SQLite storage).
- No `updated_at` on config rows: nothing reads it.
