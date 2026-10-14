# Deploy to Cloudflare (order.shaggybobo.app)

Plan 012 · D-076. The commands below touch the real Cloudflare account, so **the owner runs them** (or the builder, with the owner's OK). Agents never run anything with `--remote`, `wrangler deploy` or `wrangler secret`.

Run everything from the project folder on the PC, after the full gate is green on the commit you deploy.

## 1 · Sign in to Cloudflare (once per PC)

```bash
pnpm exec wrangler login
```

## 2 · Create the database and image storage (once)

```bash
pnpm exec wrangler d1 create shaggybobo-order
```

Copy the `database_id` it prints into `wrangler.jsonc`, replacing `"local-only"` in `database_id` only. Leave `preview_database_id` as `"local-only"`, so your PC keeps its local data. Commit that change: the id is not a secret.

```bash
pnpm exec wrangler r2 bucket create shaggybobo-images
```

## Release notes (plan 075, D-100, from 1.0.36)

Before every deploy, **Claude writes the draft release notes** (2–4 plain lines per change, EN and ID) from the handover, and **the owner reviews them and picks which ones are included**. Only the chosen lines go into the notes file, which ships with the deploy and shows on the seller app's About page.

## Announce an update and pause the app (plan 046)

Around every release that has a migration:

1. **Announce** (any time before): admin page, "Announce an update": date, start, minutes, an optional note per language. Everyone sees a quiet "Maintenance on ..." bar until the window ends.
2. **Maintenance on**, just before the backup and migrations (admin page, "Turn maintenance on"). Customers and sellers see "Updating, back in a few minutes" and the server refuses every change (503 `maintenance`); the admin page keeps working.
3. Back up, migrate, deploy (below).
4. **Maintenance off** after the health check passes. Screens return by themselves within 30 seconds. If the release fails, leave it on.

Optional, for a script: a secret `MAINTENANCE_TOKEN` (`pnpm exec wrangler secret put MAINTENANCE_TOKEN`) lets `POST /api/maintenance` with `Authorization: Bearer <token>` and `{"maintenance": true|false}` switch it without a passkey (it works on that route only).

## 3 · Create the tables in the real database

**Back up first, every time** (owner, 2026-10-13), before any migration or deploy. The `backups/` folder is git-ignored: the file holds real orders and first names, so it stays on this PC.

```bash
pnpm exec wrangler d1 export shaggybobo-order --remote --output backups/shaggybobo-YYYY-MM-DD.sql
```

Cloudflare's Time Travel can also restore the database to any minute of the last 7 days (Free plan): `pnpm exec wrangler d1 time-travel info shaggybobo-order`.

```bash
pnpm exec wrangler d1 migrations apply shaggybobo-order --remote
```

Run this again after every deploy that adds a file to `migrations/`.

## 4 · Secrets (once; never commit them)

1. **Admin setup key.** Make a new, long one (not the dev key in `.dev.vars.example`) and keep it in a password manager:

   ```bash
   pnpm exec wrangler secret put ADMIN_SETUP_KEY
   ```

2. **Web push keys.** Make the pair once and keep it; a new pair cuts off every customer's notifications:

   ```bash
   node scripts/vapid-keys.mjs
   ```

   Then add each of the three values it prints:

   ```bash
   pnpm exec wrangler secret put VAPID_PUBLIC_KEY
   ```

   ```bash
   pnpm exec wrangler secret put VAPID_PRIVATE_KEY
   ```

   ```bash
   pnpm exec wrangler secret put VAPID_SUBJECT
   ```

   `VAPID_SUBJECT` is a contact address such as `mailto:you@example.com`.

**Never set `DEV_TOOLS`** on Cloudflare. It switches on reset-everything and no-sign-in (D-076).

## 5 · Deploy

```bash
pnpm run deploy
```

It builds and uploads. The app is then at **`https://order.shaggybobo.app`** (D-077). Cloudflare creates the address and its certificate on the first deploy, because `shaggybobo.app` is in the same account; the first load can take a minute. There is no `workers.dev` address, because passkeys work only on the one address they were made on.

Addresses:
- customers: `order.shaggybobo.app/<kitchen>`, e.g. `/onde-onde` and `/onde-onde-demo`;
- seller sign-in: `order.shaggybobo.app/seller/sign-in?kitchen=<kitchen>`;
- seller app: `order.shaggybobo.app/seller`;
- admin: `order.shaggybobo.app/admin`.

## 6 · First visit

1. Open `/admin/setup`, enter the admin setup key and register the admin passkey.
2. In admin, create the kitchens:
   - **Onde Onde** (real). Sign in as its seller. On the PC's local app, open Onde Onde → **Backup**, export the file, and **Restore** it on Cloudflare. Then upload again the pictures you uploaded on the PC (the built-in sample pictures come across by themselves).
   - **The demo kitchen.** Restore the same backup, switch **Demo kitchen** on in admin, and use "Add 50 sample orders" there.
3. Invite chefs from each kitchen's Settings.

## 7 · Phone checks

- **iPhone:**
  1. Open the kitchen link in Safari, then Share → Add to Home Screen.
  2. Open the app from the home screen, place an order and allow notifications.
  3. On the seller side, confirm the order; the notification should arrive. Push works on iPhone only from the home-screen app.
- **Android:** Chrome → Install app, then the same steps.
- **Seller tablet:** sign in with a passkey, take orders and print labels.

## 8 · When something is wrong

- Live logs:

  ```bash
  pnpm exec wrangler tail
  ```

- Back to the previous version:

  ```bash
  pnpm exec wrangler rollback
  ```

  A rollback does not undo database migrations, so add migrations only in a way that the old version still works with.

- **All admin devices are lost** (no device can sign in at `/admin/sign-in`, so nobody can make a 6-digit code). If any admin device still works, don't do this: make a code on `/admin` → **Your devices** → **Add a device** instead. Otherwise the owner, in their own terminal:
  1. Remove the admin's devices and sessions. Kitchens, orders and seller logins are untouched.

     ```bash
     pnpm exec wrangler d1 execute shaggybobo-order --remote --command "DELETE FROM sessions WHERE account_id = 'admin'; DELETE FROM devices WHERE account_id = 'admin';"
     ```

  2. Set a new setup key (the old one is useless once used):

     ```bash
     pnpm exec wrangler secret put ADMIN_SETUP_KEY
     ```

  3. Open `https://order.shaggybobo.app/admin/setup`, enter the new key and create a passkey. Then add the second admin's device with a 6-digit code (plan 027, D-080).

  The statement was checked on a copy of the schema (plan 027, stage 4): it leaves no admin devices or sessions, which is exactly when `/admin/setup` accepts a key again.
